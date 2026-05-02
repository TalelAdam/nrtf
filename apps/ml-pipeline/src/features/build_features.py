"""
build_features.py — turn long.parquet into features.parquet.

WHY A SEPARATE STEP
-------------------
Re-computing lag/rolling features every time you train wastes time. Compute
them once, write them to disk, then training reads a ready-made table.
This is also what real "feature stores" do (just with more bureaucracy).

INPUT  : data/processed/tri-gen/long.parquet   (ts, sensor_id, value, unit, ...)
OUTPUT : data/processed/tri-gen/features.parquet
         (everything from input + calendar + lag_<k> + rmean_<w> + rstd_<w>)

USAGE
-----
    cd apps/ml-pipeline
    python -m src.features.build_features
"""

from __future__ import annotations

import json
from datetime import datetime

import pandas as pd

from src.utils.io import paths, ensure_dirs, require_long_parquet
from src.utils.time_features import (
    DEFAULT_LAGS_DAILY, DEFAULT_LAGS_HOURLY,
    DEFAULT_ROLLINGS_DAILY, DEFAULT_ROLLINGS_HOURLY,
    add_calendar_features, add_lag_features, add_rolling_features,
    cadence_label, infer_step_seconds,
)


def build_for_sensor(group: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """One sensor at a time, sorted by ts. Returns (features_df, meta)."""
    g = group.sort_values("ts").reset_index(drop=True)
    step_s = infer_step_seconds(g["ts"])
    cadence = cadence_label(step_s)
    lags = DEFAULT_LAGS_HOURLY if cadence == "hourly" else DEFAULT_LAGS_DAILY
    windows = DEFAULT_ROLLINGS_HOURLY if cadence == "hourly" else DEFAULT_ROLLINGS_DAILY

    g = add_calendar_features(g, "ts")
    g = add_lag_features(g, "value", lags)
    g = add_rolling_features(g, "value", windows)

    meta = {
        "sensor_id": g["sensor_id"].iloc[0] if len(g) else "?",
        "rows": int(len(g)),
        "ts_min": g["ts"].min().isoformat() if len(g) else None,
        "ts_max": g["ts"].max().isoformat() if len(g) else None,
        "step_seconds": step_s,
        "cadence": cadence,
        "lags": list(lags),
        "rolling_windows": list(windows),
    }
    return g, meta


def main() -> None:
    require_long_parquet()
    ensure_dirs()

    df = pd.read_parquet(paths.long_parquet)
    df["ts"] = pd.to_datetime(df["ts"])
    print(f"[info] loaded {len(df):,} rows / {df['sensor_id'].nunique()} sensors")

    parts: list[pd.DataFrame] = []
    metas: list[dict] = []
    for sensor_id, group in df.groupby("sensor_id", sort=False):
        feat, meta = build_for_sensor(group)
        parts.append(feat)
        metas.append(meta)
        print(f"  - {sensor_id:<28s}  rows={meta['rows']:>5,}  cadence={meta['cadence']}")

    out = pd.concat(parts, ignore_index=True)
    out.to_parquet(paths.features_parquet, index=False)
    print(f"[ok] wrote {paths.features_parquet}  ({len(out):,} rows, {out.shape[1]} cols)")

    meta_path = paths.processed_tri_gen / "_features_manifest.json"
    meta_path.write_text(json.dumps(
        {"build_ts": datetime.utcnow().isoformat(timespec="seconds") + "Z",
         "sensors": metas},
        indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[ok] wrote {meta_path}")


if __name__ == "__main__":
    main()
