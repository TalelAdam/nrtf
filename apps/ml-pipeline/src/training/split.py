"""
split.py — temporal train/val/test splits.

For time series you NEVER use random shuffling. Always split by time:
the model must be evaluated on data that comes AFTER the data it learned on.
Otherwise you've leaked the future into training and your metrics lie.

Convention here:
- test  = last `test_days` of data
- val   = the `val_days` before that
- train = everything before val
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

import pandas as pd


@dataclass
class Split:
    train: pd.DataFrame
    val: pd.DataFrame
    test: pd.DataFrame
    train_end: pd.Timestamp
    val_end: pd.Timestamp


def temporal_split(df: pd.DataFrame, test_days: int = 14, val_days: int = 14,
                   ts_col: str = "ts") -> Split:
    """
    df is one sensor's worth of rows, sorted by ts.
    If the dataset is too short for the requested windows we shrink them
    proportionally rather than crash.
    """
    df = df.sort_values(ts_col).reset_index(drop=True)
    if len(df) == 0:
        return Split(df, df, df, pd.NaT, pd.NaT)

    span = (df[ts_col].max() - df[ts_col].min()).days
    if span < (test_days + val_days) * 2:
        # Not enough data for the requested split. Use last 20% / 20%.
        n = len(df)
        n_test = max(1, n // 5)
        n_val = max(1, n // 5)
        train_end_i = n - n_test - n_val
        val_end_i = n - n_test
        return Split(
            train=df.iloc[:train_end_i].copy(),
            val=df.iloc[train_end_i:val_end_i].copy(),
            test=df.iloc[val_end_i:].copy(),
            train_end=df[ts_col].iloc[train_end_i - 1] if train_end_i > 0 else df[ts_col].iloc[0],
            val_end=df[ts_col].iloc[val_end_i - 1] if val_end_i > 0 else df[ts_col].iloc[0],
        )

    test_start = df[ts_col].max() - timedelta(days=test_days)
    val_start = test_start - timedelta(days=val_days)
    train = df[df[ts_col] < val_start].copy()
    val = df[(df[ts_col] >= val_start) & (df[ts_col] < test_start)].copy()
    test = df[df[ts_col] >= test_start].copy()
    return Split(train=train, val=val, test=test,
                 train_end=val_start, val_end=test_start)
