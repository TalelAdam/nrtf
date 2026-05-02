"""
train_forecaster.py — per-sensor forecasters: seasonal-naive baseline + LightGBM.

WHAT WE TRAIN, FOR EACH SENSOR
------------------------------
1. Seasonal-naive baseline: y_hat[t] = y[t - season]
   For daily data we use season=7 (same day last week). For hourly data, 168.
   This is the "stupid" model. It's surprisingly hard to beat on routine
   industrial loads. If LightGBM can't beat it, you have a bug.

2. LightGBM regressor: gradient-boosted trees on calendar + lag + rolling
   features. Fast to train, tolerant of missing data, gives feature importances
   you can show in the pitch.

ONE MODEL PER SENSOR
--------------------
Different sensors have wildly different scales (kWh vs °C vs bar) and dynamics.
Per-sensor models are simpler to reason about, easier to debug, and trivial to
serve from FastAPI ("/predict/<sensor_id>").

OUTPUT
------
checkpoints/forecaster/<sensor_id>/
    model.lgb            # LightGBM booster
    feature_columns.json # exact column order needed at inference
    metadata.json        # cadence, lags, train period, metrics on val + test
    forecast_test.csv    # y_true vs y_pred on the test window (for eval stage)

experiments/<run>/...    # MLflow tracking (open with `mlflow ui --backend-store-uri experiments/`)
"""

from __future__ import annotations

import json
import warnings
from datetime import datetime
from pathlib import Path

import lightgbm as lgb
import mlflow
import numpy as np
import pandas as pd

from src.training.metrics import all_metrics
from src.training.split import temporal_split
from src.utils.io import paths, ensure_dirs, mlflow_tracking_uri
from src.utils.time_features import (
    DEFAULT_LAGS_DAILY, DEFAULT_LAGS_HOURLY,
    DEFAULT_ROLLINGS_DAILY, DEFAULT_ROLLINGS_HOURLY,
    cadence_label, feature_columns, infer_step_seconds,
)

warnings.filterwarnings("ignore", category=UserWarning)

LGB_PARAMS = {
    "objective": "regression_l1",   # MAE-aligned loss
    "metric": "mae",
    "learning_rate": 0.05,
    "num_leaves": 31,
    "min_data_in_leaf": 5,           # small dataset: allow narrow leaves
    "feature_fraction": 0.9,
    "bagging_fraction": 0.9,
    "bagging_freq": 5,
    "verbose": -1,
}
NUM_BOOST_ROUND = 500
EARLY_STOPPING_ROUNDS = 30
TEST_DAYS = 14
VAL_DAYS = 14


# --------------------------------------------------------------------------------------

def seasonal_naive_predict(history: pd.Series, target_index: pd.DatetimeIndex,
                           season_steps: int) -> np.ndarray:
    """For each ts in target_index, look up history[ts - season_steps] (in steps)."""
    full = history.copy()
    out = []
    for ts in target_index:
        # Find the value `season_steps` rows back. Since we have a time index,
        # we use a step-based offset instead of a clock offset (more robust to gaps).
        if ts in full.index:
            pos = full.index.get_loc(ts)
            ref_pos = pos - season_steps
        else:
            # ts is in the future relative to history; project from end
            ref_pos = len(full) - season_steps + 0
        out.append(full.iloc[ref_pos] if 0 <= ref_pos < len(full) else np.nan)
    return np.asarray(out, dtype=float)


def lags_for(cadence: str) -> tuple[tuple[int, ...], tuple[int, ...], int]:
    """Return (lags, rolling windows, seasonal-naive period in steps)."""
    if cadence == "hourly":
        return DEFAULT_LAGS_HOURLY, DEFAULT_ROLLINGS_HOURLY, 168
    return DEFAULT_LAGS_DAILY, DEFAULT_ROLLINGS_DAILY, 7


def train_one_sensor(sensor_id: str, df: pd.DataFrame, log: list[str]) -> dict | None:
    g = df[df["sensor_id"] == sensor_id].sort_values("ts").reset_index(drop=True)
    if len(g) < 30:
        log.append(f"[skip] {sensor_id}: only {len(g)} rows")
        return None

    step_s = infer_step_seconds(g["ts"])
    cadence = cadence_label(step_s)
    lags, windows, season = lags_for(cadence)

    # Drop rows where lag features couldn't be computed (early history).
    feat_cols = feature_columns(g)
    g_model = g.dropna(subset=feat_cols + ["value"]).copy()
    if len(g_model) < 30:
        log.append(f"[skip] {sensor_id}: only {len(g_model)} rows after lag NA drop")
        return None

    split = temporal_split(g_model, test_days=TEST_DAYS, val_days=VAL_DAYS)
    if len(split.train) < 10 or len(split.val) < 1 or len(split.test) < 1:
        log.append(f"[skip] {sensor_id}: split too small "
                   f"(train={len(split.train)} val={len(split.val)} test={len(split.test)})")
        return None

    # Baseline (seasonal-naive). History = train+val concatenated.
    history = pd.concat([split.train, split.val]).set_index("ts")["value"]
    y_test = split.test["value"].to_numpy(dtype=float)
    test_idx = pd.DatetimeIndex(split.test["ts"])
    y_pred_baseline = seasonal_naive_predict(history, test_idx, season_steps=season)
    baseline_metrics = all_metrics(y_test, y_pred_baseline)

    # LightGBM
    X_train = split.train[feat_cols]; y_train = split.train["value"].to_numpy()
    X_val   = split.val[feat_cols];   y_val   = split.val["value"].to_numpy()
    X_test  = split.test[feat_cols];  # same y_test as above

    train_set = lgb.Dataset(X_train, y_train, free_raw_data=False)
    val_set   = lgb.Dataset(X_val, y_val, reference=train_set, free_raw_data=False)
    booster = lgb.train(
        LGB_PARAMS, train_set,
        num_boost_round=NUM_BOOST_ROUND,
        valid_sets=[train_set, val_set],
        valid_names=["train", "val"],
        callbacks=[lgb.early_stopping(EARLY_STOPPING_ROUNDS, verbose=False),
                   lgb.log_evaluation(period=0)],
    )
    y_pred_lgb = booster.predict(X_test)
    lgb_metrics = all_metrics(y_test, y_pred_lgb)

    # Persist
    out = paths.forecaster_dir / sensor_id
    out.mkdir(parents=True, exist_ok=True)
    booster.save_model(str(out / "model.lgb"))
    (out / "feature_columns.json").write_text(json.dumps(feat_cols, indent=2), encoding="utf-8")

    forecast_df = pd.DataFrame({
        "ts": split.test["ts"].values,
        "y_true": y_test,
        "y_pred_baseline": y_pred_baseline,
        "y_pred_lgb": y_pred_lgb,
    })
    forecast_df.to_csv(out / "forecast_test.csv", index=False)

    metadata = {
        "sensor_id": sensor_id,
        "cadence": cadence,
        "step_seconds": step_s,
        "rows_total": int(len(g_model)),
        "rows_train": int(len(split.train)),
        "rows_val": int(len(split.val)),
        "rows_test": int(len(split.test)),
        "ts_train_end": str(split.train_end),
        "ts_val_end": str(split.val_end),
        "lags": list(lags),
        "rolling_windows": list(windows),
        "season_steps": season,
        "n_features": len(feat_cols),
        "best_iteration": int(booster.best_iteration or NUM_BOOST_ROUND),
        "metrics_baseline_test": baseline_metrics,
        "metrics_lgb_test": lgb_metrics,
        "lgb_feature_importance_top10": dict(sorted(
            zip(feat_cols, booster.feature_importance(importance_type="gain")),
            key=lambda kv: -kv[1])[:10]),
    }
    (out / "metadata.json").write_text(
        json.dumps(metadata, indent=2, default=str, ensure_ascii=False), encoding="utf-8")

    # MLflow
    with mlflow.start_run(run_name=f"forecaster:{sensor_id}"):
        mlflow.log_params({"sensor_id": sensor_id, "cadence": cadence,
                           "n_features": len(feat_cols), "season": season,
                           **{f"lgb_{k}": v for k, v in LGB_PARAMS.items()}})
        for prefix, m in [("baseline", baseline_metrics), ("lgb", lgb_metrics)]:
            for k, v in m.items():
                if v == v:  # skip NaN
                    mlflow.log_metric(f"{prefix}_{k}", v)
        mlflow.log_artifact(str(out / "metadata.json"))
        mlflow.log_artifact(str(out / "forecast_test.csv"))

    beat = ((not np.isnan(baseline_metrics["mae"])) and
            (not np.isnan(lgb_metrics["mae"])) and
            lgb_metrics["mae"] < baseline_metrics["mae"])
    log.append(
        f"  {sensor_id:<28s}  baseline_MAE={baseline_metrics['mae']:>9.3f}  "
        f"lgb_MAE={lgb_metrics['mae']:>9.3f}  {'✓ beat' if beat else '· tied/worse'}"
    )
    return metadata


def main() -> None:
    if not paths.features_parquet.exists():
        raise SystemExit("[fatal] features.parquet missing. Run:\n"
                         "  python -m src.features.build_features")
    ensure_dirs()
    mlflow.set_tracking_uri(mlflow_tracking_uri())
    mlflow.set_experiment("tri-gen-forecaster")

    df = pd.read_parquet(paths.features_parquet)
    df["ts"] = pd.to_datetime(df["ts"])

    log: list[str] = []
    summary = []
    for sensor_id in sorted(df["sensor_id"].unique()):
        meta = train_one_sensor(sensor_id, df, log)
        if meta:
            summary.append({
                "sensor_id": sensor_id,
                "cadence": meta["cadence"],
                "rows": meta["rows_total"],
                "baseline_mae": meta["metrics_baseline_test"]["mae"],
                "lgb_mae": meta["metrics_lgb_test"]["mae"],
                "baseline_smape": meta["metrics_baseline_test"]["smape"],
                "lgb_smape": meta["metrics_lgb_test"]["smape"],
            })

    print("\n".join(log))
    if summary:
        sdf = pd.DataFrame(summary)
        sdf["lgb_beats_baseline"] = sdf["lgb_mae"] < sdf["baseline_mae"]
        sdf.to_csv(paths.forecaster_dir / "_summary.csv", index=False)
        beats = int(sdf["lgb_beats_baseline"].sum())
        print(f"\n[done] LightGBM beat baseline on {beats}/{len(sdf)} sensors. "
              f"Summary -> {paths.forecaster_dir/'_summary.csv'}")


if __name__ == "__main__":
    main()
