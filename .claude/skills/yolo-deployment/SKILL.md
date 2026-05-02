---
name: yolo-deployment
description: Use when training and deploying a YOLO-family detector — Ultralytics CLI, dataset YAML, training recipes, ONNX export, TFLite export, TensorRT engines, edge deployment paths. Trigger on "train YOLO", "fine-tune YOLOv8", "export YOLO to ONNX", "YOLO on edge", "YOLOv10", "YOLO-World", "RT-DETR".
---

# YOLO Deployment Pipeline (Ultralytics → Edge)

Hedged kept under ADR-003 in case we need DocLayNet-style layout detection on scanned PDFs. Otherwise out of scope for Re·Tech Fusion. Quantization handed off to `edge-ai-optimizer` if invoked.

## Model selection cheat-sheet

| Need | Model | Approx params | Speed (Pi 5 INT8) | Notes |
|---|---|---:|---:|---|
| Smallest possible | YOLOv8n / YOLOv10n | 2.6 M / 2.3 M | 25-40 FPS | ESP32-S3 needs further distillation |
| Balanced edge | YOLOv8s | 11 M | 12-18 FPS | Pi 5 default |
| Strong teacher | YOLOv8m / RT-DETR-L | 25 M / 32 M | cloud only | For distillation source |
| Open vocab | YOLO-World | 25 M | cloud | Bootstrapping labels |

YOLOv10 vs YOLOv8: v10 removes NMS and is faster post-processing on edge. Pick v10 if your runtime supports it; v8 if you want maximum tooling support.

## Dataset YAML

```yaml
# data/processed/labels/ppe/cleanroom_ppe.yaml
path: /sessions/.../mnt/NRTF/data/processed/labels/ppe
train: train/images
val: val/images
test: test/images
names:
  0: person
  1: mask
  2: gown
  3: gloves
  4: head_cover
```

Folder layout the YAML expects:

```
labels/ppe/
├── train/
│   ├── images/  # .jpg
│   └── labels/  # .txt (YOLO format: class cx cy w h)
├── val/
└── test/
```

## Training command (Ultralytics)

```bash
yolo detect train \
  model=yolov8n.pt \
  data=data/processed/labels/ppe/cleanroom_ppe.yaml \
  epochs=80 imgsz=640 batch=16 \
  optimizer=AdamW lr0=2e-3 \
  cos_lr=True patience=20 \
  augment=True mosaic=0.0 \
  project=runs/ppe name=yolov8n_v1
```

Notes:
- `mosaic=0.0` — turn off Mosaic for industrial / safety datasets (it kills small-object recall).
- `imgsz=640` — drop to 320 only if the target chip can't handle 640.
- `patience=20` — early stop if val mAP plateaus.

## Export paths

```bash
# ONNX (universal)
yolo export model=runs/ppe/yolov8n_v1/weights/best.pt format=onnx imgsz=640 simplify=True opset=13

# TFLite INT8 (Pi 5, mobile)
yolo export model=...best.pt format=tflite imgsz=640 int8=True data=...cleanroom_ppe.yaml

# TensorRT engine (Jetson)
yolo export model=...best.pt format=engine imgsz=640 half=True device=0

# Edge TPU (Coral)
yolo export model=...best.pt format=edgetpu imgsz=320 data=...

# OpenVINO (Intel CPU/iGPU)
yolo export model=...best.pt format=openvino imgsz=640
```

Hand the resulting artifact to `edge-ai-optimizer` for quantization tuning + on-device benchmark.

## Inference (server-side)

```python
from ultralytics import YOLO
model = YOLO("runs/ppe/yolov8n_v1/weights/best.pt")
results = model.predict("frame.jpg", conf=0.4, iou=0.5)
boxes = results[0].boxes.xyxy.cpu().numpy()  # (N, 4)
classes = results[0].boxes.cls.cpu().numpy()
```

For ONNX-Runtime serving:

```python
import onnxruntime as ort
sess = ort.InferenceSession("model.onnx", providers=["CPUExecutionProvider"])
out = sess.run(None, {"images": preprocessed})  # (1, 84, 8400) for v8 / (1, 300, 6) for v10
```

## Distillation recipe (teacher → student)

```python
# In apps/edge-runtime/distillation/yolo_kd.py
from ultralytics import YOLO
teacher = YOLO("runs/ppe/yolov8m_teacher/weights/best.pt")
# Use teacher predictions as soft labels, train student on combined hard+soft loss.
# torchdistill provides a high-level harness; or write a custom loss with
#   alpha * BCE(student_logits, hard_labels) + (1-alpha) * KL(student_logits, teacher_logits/T)
```

Default KD hyperparameters: τ=4, α=0.7, 1-2 epochs of fine-tune on the same dataset.

## On-device benchmark contract

For any new export, the benchmark harness produces:

```
| Target        | Runtime         | imgsz | Latency P50 | Latency P95 | mAP@0.5 |
|---------------|-----------------|------:|------------:|------------:|--------:|
| Pi 5 (INT8)   | onnxruntime     |  640  |    34 ms    |    48 ms    |  0.847  |
| Pi 5 (FP16)   | onnxruntime     |  640  |    52 ms    |    71 ms    |  0.863  |
| Jetson (FP16) | TensorRT 8.6    |  640  |    11 ms    |    14 ms    |  0.860  |
| ESP32-S3      | TFLite-Micro    |  192  |   190 ms    |   220 ms    |  0.71*  |
```

`*` lower number on ESP32-S3 reflects distilled student, not the teacher.

## Things NOT to do

- Don't use Mosaic on industrial / safety datasets — it cuts small-object recall.
- Don't default to imgsz=1280 unless the chip can handle it.
- Don't ship without an mAP@0.5 *and* mAP@0.5:0.95 number.
- Don't quantize the YOLO `Detect` head naively — it has activation ranges that hurt under PTQ. Use Ultralytics' `int8=True` flag (it handles this).

## Hackathon shortcuts

- `yolo predict source=video.mp4 model=yolov8n.pt save=True` — annotated video in 30 seconds.
- `supervision.ByteTrack()` + `supervision.BoxAnnotator()` — tracking + drawing in three lines.
- For zero-shot: YOLO-World with prompts, no training needed for the demo H1 baseline.
