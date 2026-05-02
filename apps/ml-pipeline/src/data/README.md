# `src/data/` — tri-gen cleaning pipeline

Two scripts, run in order. The first observes the raw Excel files; the second
turns them into a canonical long-format Parquet plus per-sensor Excel exports.

```
raw .xlsx  ──►  inspect_tri_gen.py  ──►  _inspection_report.{md,json}
                                                  │
                                                  ▼
                                        clean_tri_gen.py  ──►  long.parquet
                                                                by-sensor/<id>.xlsx
                                                                _build_manifest.json
                                                                _cleaning_log.txt
```

## Quick start (Windows / PowerShell)

```powershell
cd D:\Hackathons\NRTF3\repo\nrtf\apps\ml-pipeline
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Step 1 — inspect the raw .xlsx files. Writes a markdown report you should read.
python -m src.data.inspect_tri_gen

# Read the report (no changes made yet):
notepad ..\..\data\processed\tri-gen\_inspection_report.md

# Step 2 — clean. Reads the JSON twin of the report.
python -m src.data.clean_tri_gen
```

## Why two scripts, not one

Industrial Excel reports are messy: header rows can sit anywhere in the top 10
rows, dates can live in the row labels, units can hide in the column header,
sheets can be named in French/Arabic. Guessing blind in the cleaner means
silent data loss. The inspector prints what it sees so we can confirm
(or override) the schema before transforming anything.

## When the auto-detection is wrong

Open `_inspection_report.md`. If a sheet's header row, date column, or sensor
columns look wrong, do **one** of:

1. Edit the corresponding entry in `_inspection_report.json` (regenerable, but
   you'll lose your edit on next inspect run).
2. Add an entry to `OVERRIDES` in `clean_tri_gen.py` keyed by
   `"<filename>::<sheetname>"`. This is the durable option.

## Why long format

The wider downstream work (forecasting, anomaly detection, CO₂ conversion,
FastAPI serving) all keys on `(sensor_id, ts)`. One model per sensor, one query
shape, one schema. See `apps/ml-pipeline/README.md` for the full layout.
