# apps/cv-pipeline

Computer vision service for AURA. Owns video ingestion, detection, tracking, and CV inference serving.

## What this app is for

- Video ingestion (RTSP, files, ESP32-CAM stream) — bounded queue, drop-old policy
- Object detection (YOLOv8/v10/RT-DETR) — fine-tuned on the leaked KILANI dataset
- Tracking (ByteTrack / BoT-SORT) — IDs across frames
- CV inference serving (FastAPI) — one router per task: PPE compliance, occupancy, plume detection
- Evaluation (mAP, HOTA, IDF1) and failure-case dashboards

This is **not** where models are trained from scratch — that's `apps/ml-pipeline/`.
This is **not** where models are quantized for edge — that's `apps/edge-runtime/`.

## Folder layout

```
apps/cv-pipeline/
├── src/
│   ├── ingest/          # rtsp_reader, file_reader, frame_sampler, roi_crop
│   ├── detection/       # yolo_runner, grounding_dino_runner
│   ├── tracking/        # bytetrack_wrapper, kalman
│   ├── inference/       # FastAPI server + per-task routers
│   ├── eval/            # coco_eval, hota, plot_failure_cases
│   ├── data/            # label_with_sam, augment
│   └── utils/
├── tasks/               # one folder per task (ppe-compliance, occupancy, plume)
│   └── <task>/
│       ├── task_card.md
│       └── dataset.yaml
└── tests/
```

## Tasks (post-leak baseline)

| Task | Output | Edge target | Metric target |
|---|---|---|---|
| PPE compliance (mask, gown, gloves) | `[{person_id, ppe, ts}]` | Pi 5 (YOLOv8n) | mAP@0.5 ≥ 0.85, recall_mask ≥ 0.95 |
| Cleanroom occupancy | `{count, ids, dwell}` | ESP32-S3 (≤ 250 KB) | recall ≥ 0.92 |
| Contamination plume | `{plume_present, area_pct}` | Pi 5 | F1 ≥ 0.85 |
| Equipment-state | `{equipment_id, state, conf}` | ESP32-S3 | accuracy ≥ 0.95 |

## Running

```bash
cd apps/cv-pipeline
uvicorn src.inference.server:app --port 8003
# router endpoints:
#   POST /cv/ppe       (frame bytes → PPE compliance struct)
#   POST /cv/occupancy (frame bytes → count + ids)
#   POST /cv/plume     (frame bytes → plume struct)
```

Owner agent: `computer-vision-engineer`.
