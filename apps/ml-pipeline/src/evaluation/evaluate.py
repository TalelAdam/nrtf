"""
evaluate.py — read trained models + their cached test predictions, produce
human-readable reports and a leaderboard.

WHAT YOU'LL SEE
---------------
apps/ml-pipeline/reports/eval/
├── index.html               # browse everything from here
├── forecaster_leaderboard.csv
├── anomaly_leaderboard.csv
├── forecaster/<sensor>.png  # y_true / baseline / lgb on the test window
└── anomaly/<sensor>.png     # value timeline with red dots = flagged events

WHY DON'T WE RECOMPUTE PREDICTIONS HERE
---------------------------------------
The training step already wrote `forecast_test.csv` (forecaster) and
`events.csv` (anomaly). We re-read those — fast, and lets us iterate on report
formatting without touching the trained models.

USAGE
-----
    cd apps/ml-pipeline
    python -m src.evaluation.evaluate
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import pandas as pd

from src.training.metrics import all_metrics
from src.utils.io import paths, ensure_dirs


def safe_filename(s: str) -> str:
    return "".join(c if c.isalnum() or c in "-_." else "_" for c in s)[:80]


# --- Forecaster -------------------------------------------------------------------------

def evaluate_forecaster(out_dir: Path) -> tuple[pd.DataFrame, list[Path]]:
    rows = []
    plots: list[Path] = []
    sensor_dirs = [p for p in paths.forecaster_dir.iterdir()
                   if p.is_dir() and (p / "forecast_test.csv").exists()]
    for sd in sorted(sensor_dirs, key=lambda p: p.name):
        sensor_id = sd.name
        forecast = pd.read_csv(sd / "forecast_test.csv", parse_dates=["ts"])
        meta = json.loads((sd / "metadata.json").read_text(encoding="utf-8"))

        m_base = all_metrics(forecast["y_true"], forecast["y_pred_baseline"])
        m_lgb  = all_metrics(forecast["y_true"], forecast["y_pred_lgb"])

        # Lift = how much LightGBM beats the baseline (positive = better)
        lift_mae = (m_base["mae"] - m_lgb["mae"]) / m_base["mae"] * 100 \
            if m_base["mae"] and m_base["mae"] == m_base["mae"] else float("nan")

        rows.append({
            "sensor_id": sensor_id,
            "cadence": meta.get("cadence"),
            "n_test": len(forecast),
            "baseline_mae": m_base["mae"], "lgb_mae": m_lgb["mae"],
            "baseline_smape": m_base["smape"], "lgb_smape": m_lgb["smape"],
            "lift_mae_pct": lift_mae,
            "best_iteration": meta.get("best_iteration"),
        })

        # Plot
        fig, ax = plt.subplots(figsize=(11, 3.4))
        ax.plot(forecast["ts"], forecast["y_true"], label="actual", lw=1.6)
        ax.plot(forecast["ts"], forecast["y_pred_baseline"], label="baseline (seasonal-naive)",
                lw=1.0, ls="--")
        ax.plot(forecast["ts"], forecast["y_pred_lgb"], label="LightGBM", lw=1.0)
        ax.set_title(f"{sensor_id}  ·  test MAE — baseline {m_base['mae']:.2f} vs lgb {m_lgb['mae']:.2f}")
        ax.legend(loc="best", fontsize=9)
        ax.xaxis.set_major_formatter(mdates.ConciseDateFormatter(mdates.AutoDateLocator()))
        fig.tight_layout()
        path = out_dir / f"{safe_filename(sensor_id)}.png"
        fig.savefig(path, dpi=110)
        plt.close(fig)
        plots.append(path)

    df = pd.DataFrame(rows).sort_values("lift_mae_pct", ascending=False)
    return df, plots


# --- Anomaly ----------------------------------------------------------------------------

def evaluate_anomaly(out_dir: Path) -> tuple[pd.DataFrame, list[Path]]:
    rows = []
    plots: list[Path] = []
    sensor_dirs = [p for p in paths.anomaly_dir.iterdir()
                   if p.is_dir() and (p / "events.csv").exists()]
    for sd in sorted(sensor_dirs, key=lambda p: p.name):
        sensor_id = sd.name
        events = pd.read_csv(sd / "events.csv", parse_dates=["ts"])

        rows.append({
            "sensor_id": sensor_id,
            "n_rows": len(events),
            "n_iforest_flags": int(events["iforest_flag"].sum()),
            "n_mad_flags": int(events["mad_flag"].sum()),
            "n_any_flags": int(events["any_flag"].sum()),
            "flag_rate_pct": float(events["any_flag"].mean() * 100),
            "iforest_score_p95": float(events["iforest_score"].quantile(0.95)),
        })

        fig, ax = plt.subplots(figsize=(11, 3.4))
        ax.plot(events["ts"], events["value"], lw=0.9, label="value")
        flagged = events[events["any_flag"] == 1]
        ax.scatter(flagged["ts"], flagged["value"], c="crimson", s=18, zorder=3,
                   label=f"flag (n={len(flagged)})")
        ax.set_title(f"{sensor_id}  ·  flagged {len(flagged)}/{len(events)} "
                     f"({len(flagged)/max(1,len(events))*100:.1f}%)")
        ax.legend(fontsize=9)
        ax.xaxis.set_major_formatter(mdates.ConciseDateFormatter(mdates.AutoDateLocator()))
        fig.tight_layout()
        path = out_dir / f"{safe_filename(sensor_id)}.png"
        fig.savefig(path, dpi=110)
        plt.close(fig)
        plots.append(path)

    df = pd.DataFrame(rows).sort_values("flag_rate_pct", ascending=False)
    return df, plots


# --- HTML index -------------------------------------------------------------------------

def write_index(out_dir: Path, fc_df: pd.DataFrame, fc_plots: list[Path],
                an_df: pd.DataFrame, an_plots: list[Path]) -> Path:
    def rel(p: Path) -> str:
        return p.relative_to(out_dir).as_posix()

    parts = []
    parts.append("<!doctype html><meta charset='utf-8'><title>Tri-gen evaluation</title>")
    parts.append("<style>body{font-family:system-ui;margin:2em;max-width:1200px}"
                 "table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:4px 8px;font-size:13px}"
                 ".grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:10px}"
                 "img{max-width:100%;border:1px solid #eee}</style>")
    parts.append("<h1>Tri-gen — evaluation</h1>")

    if not fc_df.empty:
        parts.append("<h2>Forecaster leaderboard</h2>")
        parts.append("<p>Lift = (baseline MAE − lgb MAE) / baseline MAE. Positive means LightGBM beat seasonal-naive.</p>")
        parts.append(fc_df.to_html(index=False, float_format=lambda v: f"{v:.3f}"))
        parts.append("<h3>Forecasts on test window</h3><div class='grid'>")
        for p in fc_plots:
            parts.append(f"<a href='{rel(p)}'><img src='{rel(p)}' alt='{p.name}'></a>")
        parts.append("</div>")

    if not an_df.empty:
        parts.append("<h2>Anomaly leaderboard</h2>")
        parts.append(an_df.to_html(index=False, float_format=lambda v: f"{v:.3f}"))
        parts.append("<h3>Flagged events per sensor</h3><div class='grid'>")
        for p in an_plots:
            parts.append(f"<a href='{rel(p)}'><img src='{rel(p)}' alt='{p.name}'></a>")
        parts.append("</div>")

    path = out_dir / "index.html"
    path.write_text("\n".join(parts), encoding="utf-8")
    return path


# --- Main -------------------------------------------------------------------------------

def main() -> None:
    ensure_dirs()
    out = paths.eval_dir
    out.mkdir(parents=True, exist_ok=True)

    fc_dir = out / "forecaster"
    fc_dir.mkdir(exist_ok=True)
    an_dir = out / "anomaly"
    an_dir.mkdir(exist_ok=True)

    print("[eval] forecaster")
    fc_df, fc_plots = evaluate_forecaster(fc_dir)
    if not fc_df.empty:
        fc_df.to_csv(out / "forecaster_leaderboard.csv", index=False)
        print(fc_df.to_string(index=False))

    print("\n[eval] anomaly")
    an_df, an_plots = evaluate_anomaly(an_dir)
    if not an_df.empty:
        an_df.to_csv(out / "anomaly_leaderboard.csv", index=False)
        print(an_df.to_string(index=False))

    index_path = write_index(out, fc_df, fc_plots, an_df, an_plots)
    print(f"\n[done] open in browser:\n   {index_path}")


if __name__ == "__main__":
    main()
