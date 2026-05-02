"""
metrics.py — forecasting + anomaly metrics.

MAE   : mean absolute error. Same units as the target.
RMSE  : root mean squared error. Same units as target. Penalises big misses.
MAPE  : mean absolute percentage error. Unitless. Blows up near zero.
sMAPE : symmetric MAPE. Bounded in [0, 200%]. Better when values cross zero.

For energy forecasting MAE + sMAPE is the safest pair.
"""

from __future__ import annotations

import numpy as np


def mae(y_true, y_pred) -> float:
    y_true, y_pred = np.asarray(y_true, float), np.asarray(y_pred, float)
    m = ~(np.isnan(y_true) | np.isnan(y_pred))
    return float(np.mean(np.abs(y_true[m] - y_pred[m]))) if m.any() else float("nan")


def rmse(y_true, y_pred) -> float:
    y_true, y_pred = np.asarray(y_true, float), np.asarray(y_pred, float)
    m = ~(np.isnan(y_true) | np.isnan(y_pred))
    return float(np.sqrt(np.mean((y_true[m] - y_pred[m]) ** 2))) if m.any() else float("nan")


def mape(y_true, y_pred, eps: float = 1e-6) -> float:
    y_true, y_pred = np.asarray(y_true, float), np.asarray(y_pred, float)
    m = ~(np.isnan(y_true) | np.isnan(y_pred)) & (np.abs(y_true) > eps)
    if not m.any():
        return float("nan")
    return float(np.mean(np.abs((y_true[m] - y_pred[m]) / y_true[m])) * 100)


def smape(y_true, y_pred, eps: float = 1e-6) -> float:
    y_true, y_pred = np.asarray(y_true, float), np.asarray(y_pred, float)
    m = ~(np.isnan(y_true) | np.isnan(y_pred))
    denom = (np.abs(y_true[m]) + np.abs(y_pred[m])) / 2 + eps
    if not m.any():
        return float("nan")
    return float(np.mean(np.abs(y_true[m] - y_pred[m]) / denom) * 100)


def all_metrics(y_true, y_pred) -> dict:
    return {"mae": mae(y_true, y_pred), "rmse": rmse(y_true, y_pred),
            "mape": mape(y_true, y_pred), "smape": smape(y_true, y_pred)}
