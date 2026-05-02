# Run the ML pipeline, in order

Each script is independent and reads from the previous step's output on disk.
You can stop after any stage and inspect what was produced before continuing.

## Setup (once)

```powershell
cd D:\Hackathons\NRTF3\repo\nrtf\apps\ml-pipeline
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Activate the venv every new terminal:
```powershell
.\.venv\Scripts\Activate.ps1
```

## The sequence

| # | Command | Reads from | Writes to |
|---|---|---|---|
| 1 | `python -m src.data.inspect_tri_gen` | raw `.xlsx` folder | repo-root `data/processed/tri-gen/_inspection_report.{md,json}` |
| 2 | `python -m src.data.clean_tri_gen` | inspection report | repo-root `data/processed/tri-gen/long.parquet` + `by-sensor/<id>.xlsx` + `_build_manifest.json` + `_cleaning_log.txt` |
| 3 | `python -m src.features.build_features` | `long.parquet` | repo-root `data/processed/tri-gen/features.parquet` |
| 4 | `python -m src.eda.run_eda` | `long.parquet` | `apps/ml-pipeline/reports/eda/` (open `index.html`) |
| 5 | `python -m src.training.train_forecaster` | `features.parquet` | `checkpoints/forecaster/<sensor>/...` + MLflow run |
| 6 | `python -m src.training.train_anomaly` | `features.parquet` | `checkpoints/anomaly/<sensor>/...` + MLflow run |
| 7 | `python -m src.evaluation.evaluate` | trained model dirs | `apps/ml-pipeline/reports/eval/` (open `index.html`) |

## Browse experiments

```powershell
mlflow ui --backend-store-uri file:./experiments
# then open http://127.0.0.1:5000
```

## What each stage gives you

**Stage 1 — inspect** sees what's actually in the workbooks: header rows, date
columns, sensor labels, units. Read `_inspection_report.md` and tell Claude if
the auto-detection is wrong on any sheet — we'll add an `OVERRIDES` entry.

**Stage 2 — clean** produces the canonical `long.parquet` (one row per
timestamp × sensor), plus per-sensor `.xlsx` for the chem/bio teammates.

**Stage 3 — features** adds calendar (hour, dow, month, sin/cos), lag, and
rolling features. Cached to disk so training is fast.

**Stage 4 — EDA** generates the timeseries, missingness, weekly profile,
correlation, STL decomposition, and distribution plots, plus a one-page HTML.

**Stage 5 — forecaster** trains a seasonal-naive baseline AND a LightGBM model
per sensor. The leaderboard tells you where LightGBM beat the baseline (and
where it didn't — that's a debugging signal).

**Stage 6 — anomaly** trains rolling-MAD + IsolationForest per sensor and
exports the flagged event timeline.

**Stage 7 — evaluate** reads the cached test predictions and event tables,
computes MAE / sMAPE leaderboards, and renders an HTML report you can paste
into the pitch deck.

## Common issues

- **`features.parquet missing`** — run stage 3.
- **A sensor's LightGBM is worse than baseline** — usually means too few rows
  after lag-NA drop. Lower the `min_data_in_leaf` in `train_forecaster.py`,
  or accept that this sensor is well-served by the baseline alone.
- **MAPE is `nan`** — the test window contains zeros. Use sMAPE instead.
- **Plots look empty** — check `data/processed/tri-gen/_cleaning_log.txt` for
  rows dropped during cleaning.
