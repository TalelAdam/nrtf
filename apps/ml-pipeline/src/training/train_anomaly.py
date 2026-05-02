"""
train_anomaly.py — per-sensor anomaly detectors: rolling-MAD + IsolationForest.

WHY TWO DETECTORS
-----------------
Different things are "anomalous" depending on what you ask:

- rolling-MAD  : "this single point is far from the recent local norm".
                 Catches spikes, dropouts, frozen sensors. Cheap, explainable.
                 Ideal for a streaming/edge alerting story.

- IsolationForest : "this point's combination of (value, recent context, calendar)
                 is rare across the whole history". Catches subtler patterns —
                 e.g. high consumption at 3 AM on a Sunday. Slightly more
                 black-box but better at compound anomalies.

We train both. The /anomaly endpoint can return either or a fused score.

OUTPUT
------
checkpoints/anomaly/<sensor_id>/
    iforest.pkl              # joblib-pickled sklearn IsolationForest
    feature_columns.json
    mad_thresholds.json      # rolling-MAD parameters + threshold
    events.csv               # full timeline of flagged anomalies (for the dashboard)
    metadata.json
"""

from __future__ import annotations

import json
import warnings
from pathlib import Path

import joblib
import mlflow
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from src.utils.io import paths, ensure_dirs, mlflow_tracking_uri
from src.utils.time_features import feature_columns

warnings.filterwarnings("ignore", category=UserWarning)


# --- Rolling-MAD detector ---------------------------------------------------------------

MAD_WINDOW = 28           # steps; daily-data → ~4 weeks; hourly → 28 hours (tune)
MAD_Z_THRESHOLD = 3.5     # canonical Tukey threshold; ~modified-z-score >= 3.5 → outlier
MAD_MIN_HISTORY = 7


def rolling_mad_score(values: np.ndarray, window: int = MAD_WINDOW) -> np.ndarray:
    """
    Returns the modified-z-score for each point, computed against the trailing
    `window` of values that PRECEDE it. NaN until enough history.

    Modified z-score = 0.6745 * (x - median) / MAD.
    """
    n = len(values)
    out = np.full(n, np.nan, dtype=float)
    for i in range(n):
        lo = max(0, i - window)
        hist = values[lo:i]
        if len(hist) < MAD_MIN_HISTORY:
            continue
        med = np.median(hist)
        mad = np.median(np.abs(hist - med))
        if mad == 0:
            continue
        out[i] = 0.6745 * (values[i] - med) / mad
    return out


# --- IsolationForest --------------------------------------------------------------------

IFOREST_PARAMS = {
    "n_estimators": 200,
    "contamination": "auto",
    "random_state": 42,
    "n_jobs": -1,
}


def train_one_sensor(sensor_id: str, df: pd.DataFrame, log: list[str]) -> dict | None:
    g = df[df["sensor_id"] == sensor_id].sort_values("ts").reset_index(drop=True)
    if len(g) < 30:
        log.append(f"[skip] {sensor_id}: only {len(g)} rows")
        return None

    feat_cols = feature_columns(g)
    g_model = g.dropna(subset=feat_cols + ["value"]).copy()
    if len(g_model) < 30:
        log.append(f"[skip] {sensor_id}: too few rows after dropna ({len(g_model)})")
        return None

    # IsolationForest on (value + features)
    X = g_model[["value"] + feat_cols].to_numpy()
    iforest = IsolationForest(**IFOREST_PARAMS).fit(X)
    iforest_score = -iforest.score_samples(X)  # higher = more anomalous
    iforest_pred = (iforest.predict(X) == -1).astype(int)

    # Rolling-MAD on raw values
    mad_z = rolling_mad_score(g_model["value"].to_numpy(), window=MAD_WINDOW)
    mad_flag = (np.abs(mad_z) >= MAD_Z_THRESHOLD).astype(int)

    fused_flag = ((iforest_pred == 1) | (mad_flag == 1)).astype(int)

    events = pd.DataFrame({
        "ts": g_model["ts"].values,
        "value": g_model["value"].values,
        "iforest_score": iforest_score,
        "iforest_flag": iforest_pred,
        "mad_z": mad_z,
        "mad_flag": mad_flag,
        "any_flag": fused_flag,
    })

    out = paths.anomaly_dir / sensor_id
    out.mkdir(parents=True, exist_ok=True)
    joblib.dump(iforest, out / "iforest.pkl")
    (out / "feature_columns.json").write_text(json.dumps(["value"] + feat_cols, indent=2),
                                              encoding="utf-8")
    (out / "mad_thresholds.json").write_text(json.dumps(
        {"window": MAD_WINDOW, "z_threshold": MAD_Z_THRESHOLD,
         "min_history": MAD_MIN_HISTORY}, indent=2), encoding="utf-8")
    events.to_csv(out / "events.csv", index=False)

    n_flagged = int(fused_flag.sum())
    flag_rate = float(n_flagged / len(events))
    metadata = {
        "sensor_id": sensor_id,
        "rows": int(len(events)),
        "n_iforest_flags": int(iforest_pred.sum()),
        "n_mad_flags": int(mad_flag.sum()),
        "n_any_flags": n_flagged,
        "flag_rate": flag_rate,
        "iforest_params": IFOREST_PARAMS,
        "mad_window": MAD_WINDOW,
        "mad_z_threshold": MAD_Z_THRESHOLD,
    }
    (out / "metadata.json").write_text(json.dumps(metadata, indent=2, default=str), encoding="utf-8")

    with mlflow.start_run(run_name=f"anomaly:{sensor_id}"):
        mlflow.log_params({"sensor_id": sensor_id, "n_features": len(feat_cols),
                           "mad_window": MAD_WINDOW, "mad_z": MAD_Z_THRESHOLD,
                           **{f"iforest_{k}": v for k, v in IFOREST_PARAMS.items()}})
        mlflow.log_metric("n_flags", n_flagged)
        mlflow.log_metric("flag_rate", flag_rate)
        mlflow.log_artifact(str(out / "metadata.json"))
        mlflow.log_artifact(str(out / "events.csv"))

    log.append(f"  {sensor_id:<28s}  rows={len(events):>5}  flags={n_flagged:>4}  rate={flag_rate*100:.1f}%")
    return metadata


def main() -> None:
    if not paths.features_parquet.exists():
        raise SystemExit("[fatal] features.parquet missing. Run:\n"
                         "  python -m src.features.build_features")
    ensure_dirs()
    mlflow.set_tracking_uri(mlflow_tracking_uri())
    mlflow.set_experiment("tri-gen-anomaly")

    df = pd.read_parquet(paths.features_parquet)
    df["ts"] = pd.to_datetime(df["ts"])

    log: list[str] = []
    summary = []
    for sensor_id in sorted(df["sensor_id"].unique()):
        meta = train_one_sensor(sensor_id, df, log)
        if meta:
            summary.append({"sensor_id": sensor_id, **{k: v for k, v in meta.items()
                              if k not in ("iforest_params",)}})

    print("\n".join(log))
    if summary:
        sdf = pd.DataFrame(summary)
        sdf.to_csv(paths.anomaly_dir / "_summary.csv", index=False)
        print(f"\n[done] anomaly summary -> {paths.anomaly_dir/'_summary.csv'}")


if __name__ == "__main__":
    main()
