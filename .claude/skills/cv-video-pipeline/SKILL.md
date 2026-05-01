---
name: cv-video-pipeline
description: Use when ingesting, sampling, or processing video for computer vision — OpenCV/PyAV/decord, frame sampling strategies, ROI cropping, color-space conversion, RTSP streams, frame queues, drop policies. Trigger on "process video", "read RTSP", "sample frames", "video ingestion", "ffmpeg pipeline", "build a video reader".
---

# CV Video Pipeline Patterns

Companion to `computer-vision-engineer`. Defines the canonical way to get pixels into the model — fast, lossless where it matters, lossy where it doesn't.

## Reader selection

| Use case | Reader | Why |
|---|---|---|
| Random-access training (need frame N) | `decord.VideoReader` | Fast keyframe + delta seek; pythonic |
| Sequential decoding at scale | `PyAV` | C-speed, fine-grained control, multi-threaded |
| Live RTSP / webcam | `cv2.VideoCapture(... CAP_FFMPEG)` | Battle-tested, GStreamer fallback |
| Massive batch transcode | `ffmpeg` CLI subprocess | Fastest, no Python overhead |
| Notebook EDA | `decord` + matplotlib | Quick |

## Frame sampling strategies

```python
# 1. Fixed FPS sample (default for training)
ffmpeg -i in.mp4 -vf fps=2 -q:v 2 frames/%06d.jpg

# 2. Motion-triggered (skip static frames)
import cv2, numpy as np
prev = None
for i, frame in enumerate(reader):
    g = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    if prev is not None and np.mean(np.abs(g.astype(int) - prev.astype(int))) > 4.0:
        save(frame, i)
    prev = g

# 3. Keyframe-only (drastic compression-aware sample)
ffmpeg -i in.mp4 -vf "select='eq(pict_type,I)'" -vsync vfr keyframes/%06d.jpg

# 4. Stratified-by-shift (industrial video — sample evenly across shifts)
# done in Polars over the frame_index.parquet
```

## RTSP reader with bounded queue + drop-old policy

```python
import cv2, queue, threading, time

class RtspReader:
    def __init__(self, url, q_size=4):
        self.cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
        self.q = queue.Queue(maxsize=q_size)
        self.alive = True
        threading.Thread(target=self._loop, daemon=True).start()

    def _loop(self):
        while self.alive:
            ok, frame = self.cap.read()
            if not ok:
                time.sleep(0.05); continue
            if self.q.full():
                try: self.q.get_nowait()  # drop oldest
                except queue.Empty: pass
            self.q.put((time.time(), frame))

    def read(self, timeout=1.0):
        return self.q.get(timeout=timeout)

    def close(self):
        self.alive = False; self.cap.release()
```

This is the pattern. Drop-old beats drop-new for live inference: stale frames lie about the present.

## ROI cropping

```python
# Static ROI (camera position fixed)
roi = (x0, y0, x1, y1)
crop = frame[roi[1]:roi[3], roi[0]:roi[2]]

# Dynamic ROI from a previous-frame tracker
crop = frame[max(0,t.y-pad):t.y+t.h+pad, max(0,t.x-pad):t.x+t.w+pad]
```

Cropping early saves 80% of inference compute in cleanroom scenarios where the action is in 30% of the frame.

## Color space + resize policy

- Default: BGR → RGB → resize to model input → normalize. Done in albumentations or torchvision transforms.
- For ESP32-CAM: model input often 96×96 grayscale. Convert on-device (`esp_camera_fb_get` returns RGB565 → grayscale + downscale).
- Letterbox vs stretch: YOLO uses letterbox (preserve aspect, pad to 640). Don't stretch unless the model was trained that way.

## Inference loop skeleton

```python
from src.ingest.rtsp_reader import RtspReader
from src.detection.yolo_runner import YoloRunner
import supervision as sv

reader = RtspReader("rtsp://192.168.1.50/cam1")
yolo = YoloRunner("models/exports/aura_yolov8n_v3.onnx")
tracker = sv.ByteTrack()
ann = sv.BoxAnnotator()

while True:
    ts, frame = reader.read()
    dets = yolo.predict(frame)            # supervision.Detections
    dets = tracker.update_with_detections(dets)
    annotated = ann.annotate(frame.copy(), dets)
    publish_to_dashboard(annotated)
    publish_to_agent(structured(dets, ts))
```

## Worker process per stream + Redis Streams (multi-camera)

```
main.py spawns one process per camera_id
each process: RtspReader → model → Redis XADD stream:<camera_id> {frame: jpg, ts, dets: json}
backend: subscribes to streams, writes to TimescaleDB
frontend: WebSocket bridge from Redis → browser
```

## ffmpeg recipes (memorize these)

```
# Extract frames at 2 FPS, 90% JPEG quality
ffmpeg -i in.mp4 -vf fps=2 -q:v 2 frames/%06d.jpg

# Resize to 640x360, 5 FPS, fast
ffmpeg -i in.mp4 -vf "fps=5,scale=640:360" -c:v libx264 -preset veryfast out.mp4

# Burn-in detections (debug)
ffmpeg -i in.mp4 -vf "drawbox=x=100:y=80:w=120:h=300:color=red@0.5" annotated.mp4

# Probe (resolution, fps, codec, duration)
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration in.mp4
```

## Things NOT to do

- Don't decode every frame and discard 90%. Sample at the source with `fps` filter.
- Don't read RTSP without a bounded queue + drop policy. You'll fall behind and stay behind.
- Don't store raw 4K when the model uses 640×640. Pre-resize.
- Don't normalize twice (transform pipeline + model.preprocess).
- Don't trust the timestamp from the camera; clock-sync is a separate problem.

## Hackathon shortcuts

- `decord` + `ultralytics` for offline batch: 5 lines of code.
- `ffmpeg ... | python predict.py` over a unix pipe is faster than any python-only path.
- For the demo: pre-render the "perfect run" video at H20 and have it as a backup.
