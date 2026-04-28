# @nrtf/ml-pipeline

Training + inference pipeline for NRTF.

## Layout

```
src/
├── data/
│   ├── raw/              # immutable inputs (gitignored)
│   ├── processed/        # cleaned, feature-engineered (regenerable)
│   └── external/         # third-party (NASA POWER, ENTSO-E, NASA PCoE, ...)
├── features/             # feature engineering (one file per family)
├── models/<task>/        # one file per model
│   ├── forecasting/      # Chronos, TimesFM, LSTM, LightGBM
│   ├── classification/   # NILM CNN, TinyML export
│   ├── pinn/             # battery thermal, electrolyzer efficiency
│   └── anomaly/
├── training/             # CLI entrypoints + trainers
├── evaluation/           # metrics, plots, walk-forward
├── inference/            # FastAPI server + per-model routers
├── utils/
notebooks/                # exploration
experiments/              # MLflow runs (gitignored)
checkpoints/              # saved weights (gitignored)
tests/
```

## Setup

```bash
cp .env.example .env
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Start MLflow UI (optional)
mlflow ui --backend-store-uri ./experiments

# Start inference server
uvicorn src.inference.server:app --reload --port 8002
```

## Patterns

See `.claude/skills/ml-pipeline/SKILL.md`.
