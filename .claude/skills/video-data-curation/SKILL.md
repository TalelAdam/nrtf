---
name: video-data-curation
description: Use when curating, labeling, or versioning video datasets — bootstrap labels with SAM-2 / Grounding-DINO, frame sampling for labeling, augmentation strategy for industrial video, DVC for video shards, train/val/test splits without leakage, label tooling (CVAT, Label-Studio). Trigger on "label this video", "annotate frames", "prepare training data from video", "video dataset", "DVC track video", "split video without leakage".
---

# Video Data Curation

Companion to `data-engineer` and `computer-vision-engineer`. The leaked KILANI dataset is video — this skill is about turning raw clips into a labeled, split, versioned, edge-friendly training corpus.

## Curation loop

```
raw video → frame sample → bootstrap labels (SAM-2 + GroundingDINO) →
human review (CVAT) → augmentation → splits → DVC version
```

Each arrow is a script in `apps/cv-pipeline/src/data/` with a Pandera-validated output.

## Frame sampling for labeling (not for training)

Labelers should see *useful* frames, not redundant ones. Strategies:

- **Time-stride sampling.** Every 5 seconds (matches 5 FPS at 1× playback).
- **Motion-triggered.** Skip frames with negligible motion (mean abs delta < 4 grayscale levels).
- **Embedding-cluster sampling.** Embed frames with CLIP, k-means cluster, sample one per cluster — covers diversity without manual seeding.

```python
# Motion-triggered keep
import cv2, numpy as np, decord
v = decord.VideoReader("clip.mp4")
prev = None; keep = []
for i, f in enumerate(v):
    g = cv2.cvtColor(f.asnumpy(), cv2.COLOR_RGB2GRAY)
    if prev is not None and np.mean(np.abs(g.astype(int) - prev.astype(int))) > 4.0:
        keep.append(i)
    prev = g
```

## Bootstrap labels with foundation models

```python
# Grounding-DINO + SAM-2 → bounding boxes + masks for free
from groundingdino.util.inference import load_model, predict
from sam2.sam2_image_predictor import SAM2ImagePredictor

dino = load_model("groundingdino_swint_ogc.cfg", "groundingdino_swint_ogc.pth")
sam2 = SAM2ImagePredictor.from_pretrained("facebook/sam2-hiera-base-plus")

prompt = "person . mask . gown . gloves . head cover ."
for frame in frames:
    boxes, scores, phrases = predict(model=dino, image=frame, caption=prompt,
                                     box_threshold=0.35, text_threshold=0.25)
    sam2.set_image(frame)
    masks, _, _ = sam2.predict(box=boxes.cpu().numpy(), multimask_output=False)
    save_yolo_label(frame_id, boxes, phrases)
```

Outputs land in `data/processed/labels/<task>/_auto/` for human review.

## Human review (CVAT)

- One reviewer per task. Two-pass review for safety-critical labels (PPE).
- Disagreement metric: Cohen's κ between reviewers. Target κ ≥ 0.8.
- Expected speed after foundation-model bootstrap: ~ 30 frames/min for boxes, ~ 8 frames/min for masks.

## Augmentation strategy (industrial video)

```python
import albumentations as A
A.Compose([
    A.HorizontalFlip(p=0.5),
    A.RandomBrightnessContrast(brightness_limit=0.2, contrast_limit=0.2, p=0.6),
    A.MotionBlur(blur_limit=7, p=0.2),
    A.ImageCompression(quality_lower=70, quality_upper=95, p=0.3),
    A.GaussNoise(var_limit=(5.0, 25.0), p=0.3),
    A.RandomShadow(p=0.2),
    A.HueSaturationValue(hue_shift_limit=8, sat_shift_limit=15, val_shift_limit=10, p=0.3),
],
bbox_params=A.BboxParams(format="yolo", label_fields=["class_labels"]))
```

**Avoid in industrial contexts:** Mosaic, MixUp, CutMix — they break small-object recall and confuse safety-class boundaries.

## Split without leakage (the silent killer)

Group by the right key:

| Task | Group key | Why |
|---|---|---|
| PPE per person | `person_id` | Same individual in train+test = identity leak |
| Multi-camera occupancy | `camera_id` (or `(camera, day)`) | Camera angle / lighting bias |
| Plume detection | `clip_id` (continuous segments) | Adjacent frames are nearly identical |
| Equipment-state | `equipment_id` × `shift` | Equipment-specific signature |

```python
from sklearn.model_selection import GroupShuffleSplit
gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=0)
train_idx, test_idx = next(gss.split(X, y, groups=df["camera_id"]))
```

Splits are **frozen as JSONL files** in `data/splits/`, not regenerated from a seed each run.

## DVC for video shards

```bash
dvc init
dvc remote add -d local /mnt/external_ssd/nrtf-dvc
dvc add data/processed/video_shards/
dvc add data/processed/labels/
git add data/processed/.gitignore data/processed/video_shards.dvc
git commit -m "data: add video shards v1 (47 clips, 2.3 GB, sha=abc123)"
dvc push
```

Every model run logs the DVC SHA in MLflow → exact data reproducibility.

## Manifest contract

Every video in the dataset is described in `data/processed/frame_index.parquet`:

```
| frame_id | clip_id | camera_id | shift | ts                  | path                          | width | height | sha256 |
|----------|---------|-----------|-------|---------------------|-------------------------------|-------|--------|--------|
| 00012345 | clp-007 | cam-01    | day   | 2026-04-15 09:32:11 | shards/000003.tar/000123.jpg  | 640   | 360    | ...    |
```

This is the table everyone joins against.

## Privacy

- Faces blurred in stored frames (use `mediapipe` face detector + `cv2.GaussianBlur`).
- PII never leaves the edge if the LLM is local.
- Operator IDs are anonymized; the mapping table lives only on the IIA teammate's encrypted volume.

## Things NOT to do

- Don't label every frame. Sample first. Same person standing still for 30 frames = 1 useful label.
- Don't trust Grounding-DINO labels without human review.
- Don't split by random row index when the dataset is video. Group-based split is non-negotiable.
- Don't store raw 4K labeled clips. Pre-resize to model input at ingestion.
- Don't reuse the calibration set as a validation set. They serve different purposes.

## Hackathon shortcuts

- For an H1 baseline, use **Grounding-DINO labels as-is** (no review). Train YOLOv8n on the noisy labels — it'll be 70-80% mAP and good enough for the demo.
- Replace with reviewed labels by H10.
- `fiftyone` for dataset exploration is faster than CVAT for sanity checks.
- For augmentation, `ultralytics`'s default augmentation pipeline (with `mosaic=0.0`) is fine — no need to write albumentations from scratch.
