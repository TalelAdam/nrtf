"""
time_features.py — calendar + lag + rolling features used by both the
forecaster and the anomaly detector. Centralising this means both models see
exactly the same view of the data, which is what you want.

PEDAGOGICAL NOTE
----------------
"Lag features" are the simplest, most effective feature family for time-series
forecasting. They turn the problem from "predict y_t" into "predict y_t given
y_{t-1}, y_{t-7}, y_{t-30}". A LightGBM that sees lag_1 and lag_7 is already a
respectable forecaster — and it learns nonlinear interactions a vanilla AR
model can't.

"Rolling" features (rolling_mean_7, rolling_std_7) summarise recent history.
They give the model context like "the last week has been quiet" or "noisy".
"""

from __future__ import annotations

import numpy as np
import pandas as pd


# Lags expressed in *steps*. The training script will pick the right step list
# based on the data's inferred cadence (daily vs hourly).
DEFAULT_LAGS_DAILY = (1, 2, 3, 7, 14, 28)
DEFAULT_LAGS_HOURLY = (1, 2, 3, 24, 48, 168)
DEFAULT_ROLLINGS_DAILY = (7, 14, 28)
DEFAULT_ROLLINGS_HOURLY = (24, 168)


def infer_step_seconds(ts: pd.Series) -> float:
    """Median time delta in seconds. Robust to occasional gaps."""
    diffs = ts.sort_values().diff().dropna().dt.total_seconds()
    if diffs.empty:
        return 86400.0  # default daily
    return float(diffs.median())


def cadence_label(step_s: float) -> str:
    if step_s < 5400:        # < 1.5 h
        return "hourly"
    if step_s < 36 * 3600:   # 1.5h .. 36h
        return "daily"
    return "irregular"


def add_calendar_features(df: pd.DataFrame, ts_col: str = "ts") -> pd.DataFrame:
    """Add cheap calendar features. Sin/cos encodings let trees pick up smooth cyclicity."""
    out = df.copy()
    ts = pd.to_datetime(out[ts_col])
    out["hour"] = ts.dt.hour.astype("int16")
    out["dow"] = ts.dt.dayofweek.astype("int16")            # 0 = Mon
    out["dom"] = ts.dt.day.astype("int16")
    out["month"] = ts.dt.month.astype("int16")
    out["is_weekend"] = (out["dow"] >= 5).astype("int8")
    # Sinusoidal encodings (let the model treat 23h and 0h as adjacent, etc.)
    out["dow_sin"] = np.sin(2 * np.pi * out["dow"] / 7.0)
    out["dow_cos"] = np.cos(2 * np.pi * out["dow"] / 7.0)
    out["hour_sin"] = np.sin(2 * np.pi * out["hour"] / 24.0)
    out["hour_cos"] = np.cos(2 * np.pi * out["hour"] / 24.0)
    out["month_sin"] = np.sin(2 * np.pi * (out["month"] - 1) / 12.0)
    out["month_cos"] = np.cos(2 * np.pi * (out["month"] - 1) / 12.0)
    return out


def add_lag_features(df: pd.DataFrame, value_col: str = "value",
                     lags: tuple[int, ...] = DEFAULT_LAGS_DAILY) -> pd.DataFrame:
    """Adds lag_<k> columns. Assumes df is already sorted by ts for ONE sensor."""
    out = df.copy()
    for k in lags:
        out[f"lag_{k}"] = out[value_col].shift(k)
    return out


def add_rolling_features(df: pd.DataFrame, value_col: str = "value",
                         windows: tuple[int, ...] = DEFAULT_ROLLINGS_DAILY) -> pd.DataFrame:
    """
    Rolling stats. Important: shift(1) BEFORE rolling so the window doesn't
    include the current step (that would leak the target into the features).
    """
    out = df.copy()
    base = out[value_col].shift(1)
    for w in windows:
        out[f"rmean_{w}"] = base.rolling(w, min_periods=max(2, w // 2)).mean()
        out[f"rstd_{w}"]  = base.rolling(w, min_periods=max(2, w // 2)).std()
    return out


def feature_columns(df: pd.DataFrame) -> list[str]:
    """All feature columns we generated, regardless of cadence."""
    base = ["hour", "dow", "dom", "month", "is_weekend",
            "dow_sin", "dow_cos", "hour_sin", "hour_cos", "month_sin", "month_cos"]
    lag_cols = [c for c in df.columns if c.startswith("lag_")]
    roll_cols = [c for c in df.columns if c.startswith("rmean_") or c.startswith("rstd_")]
    return [c for c in base + lag_cols + roll_cols if c in df.columns]
