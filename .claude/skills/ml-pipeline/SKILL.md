---
name: ml-pipeline
description: Use when building an ML training or inference pipeline — data loading, feature engineering, model training, evaluation, serving. Trigger on "train a model for X", "build a pipeline for Y dataset", "evaluate my model", "serve this model via API".
---

# ML Pipeline Skeleton (apps/ml-pipeline)

## Folder layout

```
src/
├── data/
│   ├── raw/                    # immutable inputs (gitignored, DVC-tracked)
│   ├── processed/              # cleaned, feature-engineered (regenerable)
│   └── external/<source>/      # third-party with README + download script
├── features/                   # one file per feature family
├── models/<task>/              # one file per model class
├── training/                   # CLI entrypoints; trainers/ = Lightning modules
├── evaluation/                 # metrics, plots, walk-forward CV
├── inference/                  # FastAPI server + per-model routers
├── utils/
└── tests/
```

## Workflow for a new task

### 1. Define the task in a `task_card.md`

```
Task: forecast STEG household consumption 24h ahead
Input: hourly load history (last 7 days), weather forecast (24h)
Output: hourly load forecast (24 values) + 90% prediction interval
Metric: MASE (target < 0.8) and PICP (target ≥ 0.85)
Validation: walk-forward, 1-day stride, 30-day train + 1-day eval
Dataset: UK-DALE (proxy) → fine-tune on 1 STEG household when available
Serving: HTTP POST /ml/predict/load_forecast {history: [...], weather: [...]}
```

### 2. Add data adapter in `data/external/<source>/`

- `download.sh` — script that fetches raw data; checks SHA256.
- `README.md` — source URL, license, citation, schema.
- `loader.py` — Python function returning a typed DataFrame (Pandera-validated).

### 3. Feature engineering in `features/<task>_features.py`

```python
import pandas as pd
from pandera.typing import DataFrame

def build_load_features(df: DataFrame) -> DataFrame:
    df = add_time_features(df)        # hour, dow, month cyclicals
    df = add_lag_features(df, lags=[1, 24, 168])
    df = add_rolling_stats(df, windows=[24, 168])
    return df.dropna()
```

### 4. Model class in `models/<task>/<model>.py`

Inherit `BaseModel` (in `models/base.py`):

```python
class BaseModel(ABC):
    @abstractmethod
    def fit(self, X, y): ...
    @abstractmethod
    def predict(self, X): ...
    @abstractmethod
    def predict_interval(self, X, alpha=0.1): ...
    @abstractmethod
    def save(self, path): ...
    @classmethod
    @abstractmethod
    def load(cls, path) -> "BaseModel": ...
```

### 5. Training script in `training/train_<task>.py`

Use Hydra config + MLflow:

```python
@hydra.main(config_path="../../config", config_name="train_load")
def main(cfg):
    mlflow.set_experiment(cfg.experiment)
    with mlflow.start_run():
        mlflow.log_params(cfg)
        df = load_data(cfg.data)
        X, y = build_features(df), df["load"]
        scores = walk_forward_cv(model_class=ChronosWrapper, X=X, y=y, cfg=cfg)
        mlflow.log_metrics(scores)
        save_model(...)
```

CLI: `python -m src.training.train_load experiment=load_v1 model=chronos`

### 6. Evaluation in `evaluation/`

- `walk_forward.py` — time-series CV.
- `metrics.py` — MASE, sMAPE, RMSE, MAE, NLL, CRPS, PICP.
- `plots.py` — residual plots, calibration plots, error-by-hour.

### 7. Inference router in `inference/routers/<task>.py`

```python
from fastapi import APIRouter
from pydantic import BaseModel

class LoadForecastRequest(BaseModel):
    history: list[float]
    weather: list[float] | None = None

class LoadForecastResponse(BaseModel):
    forecast: list[float]
    pi_low: list[float]
    pi_high: list[float]

router = APIRouter(prefix="/ml/predict")

@router.post("/load_forecast", response_model=LoadForecastResponse)
async def predict_load(req: LoadForecastRequest):
    model = get_loaded_model("load_forecast_v1")
    fc = model.predict(req.history)
    pi = model.predict_interval(req.history, alpha=0.1)
    return LoadForecastResponse(forecast=fc, pi_low=pi[0], pi_high=pi[1])
```

Mount in `inference/server.py`:

```python
from fastapi import FastAPI
from .routers import load_forecast, battery_soh, electrolyzer_eff

app = FastAPI(title="NRTF ML Inference")
app.include_router(load_forecast.router)
```

## Foundation model usage (default first attempt)

Try **Chronos-Bolt** for any forecasting task:

```python
from chronos import ChronosBoltPipeline

pipeline = ChronosBoltPipeline.from_pretrained("amazon/chronos-bolt-base")
forecast = pipeline.predict(context=torch.tensor(history), prediction_length=24)
```

Zero-shot, no training, often beats custom LSTM. Fine-tune only if zero-shot underperforms.

## PINN pattern (battery thermal example)

```python
import torch
import torch.nn as nn

class BatteryThermalPINN(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(2, 64), nn.Tanh(),     # inputs: (x, t)
            nn.Linear(64, 64), nn.Tanh(),
            nn.Linear(64, 1),                 # output: T(x, t)
        )

    def forward(self, x, t):
        return self.net(torch.cat([x, t], dim=-1))

def physics_loss(model, x, t, rho_cp, k, q_gen):
    x.requires_grad = True; t.requires_grad = True
    T = model(x, t)
    dT_dt = torch.autograd.grad(T.sum(), t, create_graph=True)[0]
    dT_dx = torch.autograd.grad(T.sum(), x, create_graph=True)[0]
    d2T_dx2 = torch.autograd.grad(dT_dx.sum(), x, create_graph=True)[0]
    residual = rho_cp * dT_dt - k * d2T_dx2 - q_gen
    return (residual ** 2).mean()

loss = data_loss + lambda_phys * physics_loss(model, x, t, RHO_CP, K, q_gen_fn(soc, current))
```

## TinyML deployment to ESP32

1. Train PyTorch model.
2. Export to TFLite via `tinymlgen` or ONNX → TF → TFLite.
3. Quantize to int8 (post-training quantization).
4. Convert to C array: `xxd -i model.tflite > model.h`.
5. Hand off `model.h` to firmware teammate; they include in ESP32 sketch.
6. Benchmark on-device: latency, RAM peak, accuracy delta.

## Things NOT to do

- Don't fit feature transformers on test data. Fit on train, transform train+test.
- Don't skip walk-forward CV for time-series. Random k-fold = data leakage.
- Don't log MLflow artifacts > 100MB; use object storage with the run as reference.
- Don't load model weights inside agent code. Always go through inference API.

## Hackathon shortcuts

- Use Chronos-Bolt zero-shot. Skip 80% of the pipeline above.
- LightGBM + cycle features beats LSTM 9 times out of 10 on tabular load data.
- Streamlit eval dashboard is faster than building a custom one.
