---
description: Scaffold a new CV experiment — task card, dataset YAML, baseline train run
argument-hint: <task-name> <dataset-path>
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# /cv-experiment — start a CV task

Spin up a vertical slice of the CV pipeline for a new task. Arguments:
- `<task-name>` — kebab-case (`ppe-compliance`, `cleanroom-occupancy`, `plume-detection`).
- `<dataset-path>` — path to a video file, a directory of clips, or a Parquet manifest.

## What this command does

1. Creates `apps/cv-pipeline/tasks/<task-name>/`:
   - `task_card.md` — input shape, output schema, metric + target, edge target, latency budget.
   - `dataset.yaml` — Ultralytics-style YAML pointing at `data/processed/labels/<task-name>/`.
   - `eval/sample.parquet` — first 100 frames + auto-labels (Grounding-DINO + SAM-2).
2. Writes a notebook stub `notebooks/<task-name>_eda.ipynb` showing 10 raw frames, FPS, resolution, illumination histogram.
3. Generates a frozen split manifest at `data/splits/<task-name>_{train,val,test}.jsonl` using the right group key (camera_id / person_id / clip_id).
4. Kicks off a baseline training run: `yolo detect train model=yolov8n.pt data=... epochs=50 mosaic=0.0 imgsz=640`.
5. Reports the baseline mAP and the gap to the edge-deployment latency target.

## Output

A `tasks/<task-name>/task_card.md` filled in, a baseline run logged to MLflow, and a one-line summary:

```
ppe-compliance | YOLOv8n@640 | mAP@0.5=0.79 | next: scale teacher to YOLOv8m, distill to student
```

Owner: `computer-vision-engineer`. Calls `data-engineer` for split generation; calls `edge-ai-optimizer` for the latency-budget check.
