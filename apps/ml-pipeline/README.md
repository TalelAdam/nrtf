# NRTF ML Pipeline

Python TRI-GEN data cleaning, feature building, EDA, forecasting, anomaly detection, and evaluation pipeline.

## Layout

```
src/
+-- data/          # inspect and clean TRI-GEN workbooks
+-- features/      # feature engineering
+-- eda/           # exploratory reports
+-- training/      # forecasting and anomaly training
+-- evaluation/    # evaluation reports
+-- utils/         # shared path and time helpers
```

Generated outputs are written outside source code:

- `data/processed/tri-gen/` from the repository root for cleaned data and features.
- `apps/ml-pipeline/reports/` for HTML reports and plots.
- `apps/ml-pipeline/checkpoints/` for trained model artifacts.
- `apps/ml-pipeline/experiments/` for MLflow runs.

## Setup

```powershell
cp .env.example .env
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run

```powershell
python -m src.data.inspect_tri_gen
python -m src.data.clean_tri_gen
python -m src.features.build_features
python -m src.eda.run_eda
python -m src.training.train_forecaster
python -m src.training.train_anomaly
python -m src.evaluation.evaluate
```

See `PIPELINE.md` for stage-by-stage details.

## Patterns

See `.claude/skills/ml-pipeline/SKILL.md`.
