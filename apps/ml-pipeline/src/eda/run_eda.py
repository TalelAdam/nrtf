"""
run_eda.py — exploratory data analysis.

WHAT YOU'LL SEE WHEN THIS FINISHES
----------------------------------
apps/ml-pipeline/reports/eda/
├── index.html              # one-page browser entry — links to everything else
├── summary.csv             # per-sensor stats: count, mean, std, min, max, missing %
├── 01_timeseries/<id>.png  # full series, one per sensor
├── 02_missingness.png      # heatmap: which sensors have gaps when?
├── 03_weekly_profile/<id>.png  # mean by (day-of-week, hour) — reveals routines
├── 04_correlation.png      # which sensors move together?
├── 05_seasonality/<id>.png # STL decomp: trend + seasonal + residual
└── 06_distributions.png    # boxplots per sensor, log-scale where appropriate

WHY THIS MATTERS
----------------
EDA is where you build intuition about the data BEFORE you fit anything. If
your weekly-profile plot shows that Sunday consumption is half of Monday, you
know lag_7 will be a strong feature. If a sensor is constant for three weeks
and then jumps, you've found an instrument fault. If two sensors correlate at
0.99, one of them might be a duplicate.

USAGE
-----
    cd apps/ml-pipeline
    python -m src.eda.run_eda
"""

from __future__ import annotations

import warnings
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # headless — no GUI required
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

from src.utils.io import paths, ensure_dirs, require_long_parquet

warnings.filterwarnings("ignore", category=FutureWarning)
sns.set_theme(context="notebook", style="whitegrid")


# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------

def safe_filename(s: str) -> str:
    return "".join(c if c.isalnum() or c in "-_." else "_" for c in s)[:80]


def to_wide(df: pd.DataFrame) -> pd.DataFrame:
    """Pivot long -> wide (ts × sensor) for plots that want a matrix view."""
    return (df.pivot_table(index="ts", columns="sensor_id", values="value", aggfunc="mean")
              .sort_index())


# --------------------------------------------------------------------------------------
# Plots
# --------------------------------------------------------------------------------------

def plot_timeseries_grid(df: pd.DataFrame, out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    files: list[Path] = []
    for sensor_id, g in df.groupby("sensor_id"):
        g = g.sort_values("ts")
        unit = (g["unit"].dropna().iloc[0] if "unit" in g and g["unit"].notna().any() else "")
        fig, ax = plt.subplots(figsize=(11, 3.2))
        ax.plot(g["ts"], g["value"], lw=0.9)
        ax.set_title(f"{sensor_id}  ({unit})" if unit else sensor_id)
        ax.set_xlabel("")
        ax.set_ylabel(unit or "value")
        ax.xaxis.set_major_locator(mdates.AutoDateLocator())
        ax.xaxis.set_major_formatter(mdates.ConciseDateFormatter(mdates.AutoDateLocator()))
        fig.tight_layout()
        path = out_dir / f"{safe_filename(sensor_id)}.png"
        fig.savefig(path, dpi=110)
        plt.close(fig)
        files.append(path)
    return files


def plot_missingness(df: pd.DataFrame, out_path: Path) -> None:
    wide = to_wide(df)
    # Resample to daily so the heatmap doesn't melt the screen.
    wide_daily = wide.resample("D").count()
    presence = (wide_daily > 0).T  # rows = sensor, cols = day
    fig, ax = plt.subplots(figsize=(12, max(3, 0.3 * len(presence))))
    sns.heatmap(presence, cbar=False, cmap="Greys", linewidths=0, ax=ax)
    ax.set_title("Daily presence (dark = data present)")
    ax.set_xlabel("date")
    ax.set_ylabel("sensor")
    fig.tight_layout()
    fig.savefig(out_path, dpi=110)
    plt.close(fig)


def plot_weekly_profile(df: pd.DataFrame, out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    files: list[Path] = []
    for sensor_id, g in df.groupby("sensor_id"):
        g = g.copy()
        g["dow"] = g["ts"].dt.dayofweek
        g["hour"] = g["ts"].dt.hour
        # If data is daily, the heatmap collapses to a single column — use a bar chart instead.
        n_unique_hours = g["hour"].nunique()
        fig, ax = plt.subplots(figsize=(8, 3.6))
        if n_unique_hours <= 3:
            mean_by_dow = g.groupby("dow")["value"].mean()
            ax.bar(mean_by_dow.index, mean_by_dow.values)
            ax.set_xticks(range(7))
            ax.set_xticklabels(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
            ax.set_ylabel("mean value")
            ax.set_title(f"Mean by day-of-week — {sensor_id}")
        else:
            mat = g.groupby(["dow", "hour"])["value"].mean().unstack("hour")
            sns.heatmap(mat, cmap="viridis", ax=ax, cbar_kws={"label": "mean"})
            ax.set_yticklabels(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], rotation=0)
            ax.set_xlabel("hour")
            ax.set_ylabel("")
            ax.set_title(f"Weekly profile — {sensor_id}")
        fig.tight_layout()
        path = out_dir / f"{safe_filename(sensor_id)}.png"
        fig.savefig(path, dpi=110)
        plt.close(fig)
        files.append(path)
    return files


def plot_correlation(df: pd.DataFrame, out_path: Path) -> None:
    wide = to_wide(df)
    if wide.shape[1] < 2:
        return
    # Use Spearman: robust to outliers and nonlinearity.
    corr = wide.corr(method="spearman")
    fig, ax = plt.subplots(figsize=(0.6 * len(corr) + 3, 0.6 * len(corr) + 3))
    sns.heatmap(corr, annot=True, fmt=".2f", center=0, cmap="vlag", ax=ax,
                cbar_kws={"label": "Spearman ρ"})
    ax.set_title("Sensor-to-sensor correlation")
    fig.tight_layout()
    fig.savefig(out_path, dpi=110)
    plt.close(fig)


def plot_seasonality(df: pd.DataFrame, out_dir: Path, top_n: int = 5) -> list[Path]:
    """STL decomposition on the most-data-rich sensors."""
    from statsmodels.tsa.seasonal import STL  # imported here so the script still
                                                # runs without statsmodels on machines
                                                # that haven't installed yet.

    out_dir.mkdir(parents=True, exist_ok=True)
    counts = df.groupby("sensor_id").size().sort_values(ascending=False)
    files: list[Path] = []
    for sensor_id in counts.head(top_n).index:
        g = (df[df["sensor_id"] == sensor_id]
             .set_index("ts")["value"]
             .sort_index())
        if len(g) < 30:
            continue
        # Pick a period from the cadence (weekly seasonality is the universal default).
        step_s = g.index.to_series().diff().dt.total_seconds().median()
        period = 7 if step_s and step_s >= 36 * 3600 else 24 * 7  # daily->7, hourly->168
        try:
            stl = STL(g.asfreq("D" if period == 7 else "H").interpolate(),
                      period=period, robust=True).fit()
        except Exception as e:
            print(f"  [warn] STL failed for {sensor_id}: {e}")
            continue
        fig, axes = plt.subplots(4, 1, figsize=(11, 7), sharex=True)
        for ax, series, title in zip(
            axes,
            [stl.observed, stl.trend, stl.seasonal, stl.resid],
            ["observed", "trend", "seasonal", "residual"],
        ):
            ax.plot(series.index, series.values, lw=0.9)
            ax.set_ylabel(title)
        axes[0].set_title(f"STL decomposition — {sensor_id}  (period={period})")
        fig.tight_layout()
        path = out_dir / f"{safe_filename(sensor_id)}.png"
        fig.savefig(path, dpi=110)
        plt.close(fig)
        files.append(path)
    return files


def plot_distributions(df: pd.DataFrame, out_path: Path) -> None:
    """Boxplots side by side. Log-scale if values span > 3 orders of magnitude."""
    fig, ax = plt.subplots(figsize=(12, max(3, 0.4 * df["sensor_id"].nunique())))
    sns.boxplot(data=df, x="value", y="sensor_id", ax=ax, fliersize=2)
    span = df["value"].abs().replace(0, np.nan).dropna()
    if not span.empty and (span.max() / span.min()) > 1000:
        ax.set_xscale("symlog")
        ax.set_xlabel("value (symlog)")
    ax.set_title("Per-sensor value distributions")
    fig.tight_layout()
    fig.savefig(out_path, dpi=110)
    plt.close(fig)


# --------------------------------------------------------------------------------------
# Summary stats
# --------------------------------------------------------------------------------------

def per_sensor_summary(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for sensor_id, g in df.groupby("sensor_id"):
        unit = (g["unit"].dropna().iloc[0] if "unit" in g and g["unit"].notna().any() else "")
        rows.append({
            "sensor_id": sensor_id,
            "unit": unit,
            "n": int(len(g)),
            "ts_min": g["ts"].min(),
            "ts_max": g["ts"].max(),
            "mean": float(g["value"].mean()),
            "std": float(g["value"].std()),
            "min": float(g["value"].min()),
            "p50": float(g["value"].median()),
            "max": float(g["value"].max()),
            "zeros": int((g["value"] == 0).sum()),
            "negatives": int((g["value"] < 0).sum()),
        })
    out = pd.DataFrame(rows).sort_values("sensor_id")
    return out


# --------------------------------------------------------------------------------------
# HTML index
# --------------------------------------------------------------------------------------

def write_index_html(out_dir: Path, summary: pd.DataFrame, image_groups: dict[str, list[Path]]) -> Path:
    def rel(p: Path) -> str:
        return p.relative_to(out_dir).as_posix()

    parts: list[str] = []
    parts.append("<!doctype html><meta charset='utf-8'><title>Tri-gen EDA</title>")
    parts.append("<style>body{font-family:system-ui;margin:2em;max-width:1200px}"
                 "h2{margin-top:2em}table{border-collapse:collapse}"
                 "td,th{border:1px solid #ddd;padding:4px 8px;font-size:13px}"
                 "img{max-width:100%;border:1px solid #eee;margin:6px 0}"
                 ".grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:10px}"
                 "</style>")
    parts.append("<h1>Tri-gen EDA report</h1>")
    parts.append(f"<p>Sensors: {len(summary)} · Rows: {int(summary['n'].sum()):,}</p>")

    parts.append("<h2>Per-sensor summary</h2>")
    parts.append(summary.to_html(index=False, float_format=lambda x: f"{x:.3f}"))

    for title, files in image_groups.items():
        if not files:
            continue
        parts.append(f"<h2>{title}</h2><div class='grid'>")
        for f in files:
            parts.append(f"<a href='{rel(f)}'><img src='{rel(f)}' alt='{f.name}'></a>")
        parts.append("</div>")

    path = out_dir / "index.html"
    path.write_text("\n".join(parts), encoding="utf-8")
    return path


# --------------------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------------------

def main() -> None:
    require_long_parquet()
    ensure_dirs()
    out = paths.eda_dir
    out.mkdir(parents=True, exist_ok=True)

    df = pd.read_parquet(paths.long_parquet)
    df["ts"] = pd.to_datetime(df["ts"])
    print(f"[info] loaded {len(df):,} rows / {df['sensor_id'].nunique()} sensors")

    summary = per_sensor_summary(df)
    summary.to_csv(out / "summary.csv", index=False)
    print(f"[ok] wrote {out/'summary.csv'}")

    print("[plot] timeseries per sensor")
    ts_files = plot_timeseries_grid(df, out / "01_timeseries")

    print("[plot] missingness heatmap")
    miss_path = out / "02_missingness.png"
    plot_missingness(df, miss_path)

    print("[plot] weekly profile per sensor")
    weekly_files = plot_weekly_profile(df, out / "03_weekly_profile")

    print("[plot] correlation heatmap")
    corr_path = out / "04_correlation.png"
    plot_correlation(df, corr_path)

    print("[plot] STL seasonality (top 5)")
    stl_files = plot_seasonality(df, out / "05_seasonality", top_n=5)

    print("[plot] distributions")
    dist_path = out / "06_distributions.png"
    plot_distributions(df, dist_path)

    image_groups = {
        "Timeseries (per sensor)": ts_files,
        "Missingness": [miss_path],
        "Weekly profile (per sensor)": weekly_files,
        "Correlation": [corr_path],
        "Seasonality (STL, top 5)": stl_files,
        "Distributions": [dist_path],
    }
    index_path = write_index_html(out, summary, image_groups)
    print(f"\n[done] open this in a browser:\n   {index_path}")


if __name__ == "__main__":
    main()
