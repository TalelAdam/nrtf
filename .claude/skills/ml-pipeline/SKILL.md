---
name: ml-pipeline
description: Use when working on apps/ml-pipeline: TRI-GEN data inspection/cleaning, feature building, EDA, forecasting, anomaly detection, evaluation, or inference handoff.
---

# ML Pipeline

Use this skill for changes under `apps/ml-pipeline`. Keep pipeline stages runnable from the app directory and preserve generated artifacts as regenerable outputs.

## App Directory

```powershell
cd apps/ml-pipeline
```

The active pipeline is the TRI-GEN time-series workflow:

```text
src/
+-- data/          # inspect and clean raw TRI-GEN workbooks
+-- features/      # build calendar, lag, and rolling features
+-- eda/           # exploratory reports and plots
+-- training/      # forecasting and anomaly training CLIs
+-- evaluation/    # evaluation report generation
+-- utils/         # shared paths, IO, and time feature helpers
```

Generated directories such as `data/processed/`, `reports/`, `experiments/`, and `checkpoints/` should be treated as outputs unless the user specifically asks to inspect or repair them.

## Pipeline Stages

Run stages in this order when building the full workflow:

| # | Command | Main input | Main output |
|---|---|---|---|
| 1 | `python -m src.data.inspect_tri_gen` | raw `.xlsx` folder | `data/processed/tri-gen/_inspection_report.{md,json}` |
| 2 | `python -m src.data.clean_tri_gen` | inspection report | `data/processed/tri-gen/long.parquet` |
| 3 | `python -m src.features.build_features` | `long.parquet` | `data/processed/tri-gen/features.parquet` |
| 4 | `python -m src.eda.run_eda` | `long.parquet` | `reports/eda/index.html` |
| 5 | `python -m src.training.train_forecaster` | `features.parquet` | `checkpoints/forecaster/` |
| 6 | `python -m src.training.train_anomaly` | `features.parquet` | `checkpoints/anomaly/` |
| 7 | `python -m src.evaluation.evaluate` | trained outputs | `reports/eval/index.html` |

Prefer running the smallest stage that verifies the change. For shared utilities, run at least the affected downstream stage.

## Setup

On Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Start MLflow when training or browsing experiments:

```powershell
mlflow ui --backend-store-uri file:./experiments
```

## Implementation Rules

- Keep CLI entrypoints importable with `python -m src.<module>`.
- Use `src.utils.io` helpers for repository and app paths instead of hard-coded absolute paths.
- Keep raw data immutable. Write cleaned or derived data under `data/processed/`.
- Treat `long.parquet` as the canonical cleaned table and `features.parquet` as the training cache.
- Fit transforms, models, scalers, and thresholds on train data only.
- Use time-aware splits for forecasting and anomaly detection. Do not use random k-fold for ordered time-series evaluation.
- Preserve sensor IDs and units in artifacts whenever possible.
- Prefer small, inspectable baselines before complex models. Seasonal naive and LightGBM are the default forecasting comparison.
- Log large or regenerable outputs as file references where possible; avoid committing generated data, reports, model weights, or MLflow runs.

## Common Fixes

- `features.parquet missing`: run `python -m src.features.build_features`.
- Empty or sparse plots: inspect `data/processed/tri-gen/_cleaning_log.txt` and confirm rows were not dropped unexpectedly.
- LightGBM worse than baseline: check row count after lag and rolling NA drops, then tune conservative leaf/min-data settings.
- `nan` MAPE: prefer sMAPE when the target contains zeros.
- Import errors from scripts: run commands from `apps/ml-pipeline` and keep package imports rooted at `src`.

## Validation Checklist

Before finishing an ML pipeline change:

1. Run `python -m compileall src` from `apps/ml-pipeline`.
2. Run the smallest affected pipeline stage.
3. Check that expected output paths are created or updated.
4. Mention any stage that could not be run because data or dependencies are missing.
