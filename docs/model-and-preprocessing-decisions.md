# Model and Preprocessing Decisions

This document explains the main technical decisions in the NRTF project: why we chose the models we chose, what preprocessing we apply before modeling, and why those steps matter for an industrial energy optimization system.

## Project Context

The system works with three main data sources:

1. Industrial tri-generation Excel reports.
2. Utility bills, scanned images, PDFs, and audit documents.
3. Live or historical sensor streams for forecasting and anomaly detection.

Because the challenge data is heterogeneous, the biggest risk is not only model accuracy. The biggest risk is unreliable input data: messy Excel files, inconsistent dates, French/Arabic invoices, scanned documents, duplicate files, missing values, and sensors with different physical units. The pipeline is therefore designed around a simple principle:

> Clean and normalize the data first, then use models that are fast, explainable, and robust enough for hackathon-time deployment.

## High-Level Modeling Strategy

We did not choose one large model for everything. We split the problem into smaller tasks:

| Task | Model or method | Why |
|---|---|---|
| Forecasting sensor values | Seasonal-naive baseline + LightGBM per sensor | Fast, strong on tabular time-series features, explainable, easy to compare against a baseline |
| Anomaly detection | Rolling MAD + IsolationForest per sensor | Combines explainable local spike detection with broader pattern anomaly detection |
| OCR | Tesseract.js with `fra+ara` | Works locally, supports French and Arabic, practical for Tunisian bills |
| Image preprocessing | Sharp grayscale, resize, contrast normalization, denoise, binarization | Improves OCR confidence on scanned and phone-captured documents |
| Structured document extraction | Claude Sonnet through LangChain structured output with Zod schemas | Converts noisy OCR/PDF text into validated JSON fields |
| Excel extraction | SheetJS + LLM header detection and schema extraction | Handles messy multi-sheet Excel reports where headers are not always on row 1 |

This is a pragmatic architecture. It favors reliability, speed, debuggability, and clear evidence over using a complex model that would be harder to train, tune, or deploy during the competition.

## Why We Chose LightGBM for Forecasting

The forecasting task predicts future sensor or energy values from historical measurements. The implemented forecaster trains one LightGBM regressor per sensor.

LightGBM was chosen because it is a very strong fit for this type of problem:

1. It performs well on tabular features.
   Energy time-series forecasting can be converted into a supervised tabular problem by adding lag features, rolling statistics, and calendar features. LightGBM is excellent at learning nonlinear relationships from those feature columns.

2. It trains quickly.
   Hackathon constraints matter. LightGBM trains in seconds to minutes per sensor, while neural sequence models or foundation time-series models are slower to fine-tune and harder to debug under time pressure.

3. It handles nonlinear patterns.
   Industrial energy data often has nonlinear behavior: weekend effects, startup/shutdown cycles, night consumption, maintenance events, and delayed effects. Tree boosting can model these interactions without requiring a deep neural architecture.

4. It gives feature importance.
   Feature importance is useful for explaining the model to judges and teammates. We can show whether the prediction depends most on previous day values, weekly seasonality, rolling means, or calendar effects.

5. It is easier to serve and maintain.
   A trained LightGBM model per sensor can be saved as `model.lgb` and loaded for inference. This is simpler than deploying a heavyweight neural model.

6. It is realistic for limited industrial data.
   The tri-generation dataset is not a massive dataset with millions of labeled examples. LightGBM is usually stronger than deep learning when the dataset is medium-sized, structured, and feature-engineered.

## Why We Also Use a Seasonal-Naive Baseline

The pipeline does not trust LightGBM blindly. For each sensor, it also computes a seasonal-naive baseline:

```text
y_hat[t] = y[t - season]
```

For daily data, the season is 7 steps, meaning "same day last week." For hourly data, the season is 168 steps, meaning "same hour last week."

This baseline is important because industrial energy loads are often highly repetitive. A simple "same time last week" forecast can be surprisingly hard to beat. If LightGBM does not beat this baseline, that tells us something useful:

- The sensor may be too regular to need a complex model.
- The feature set may not be informative enough.
- The dataset may be too small after lag feature rows are dropped.
- The sensor may have too much noise or missing data.

Using the baseline prevents us from overclaiming. It gives us a fair comparison and makes the evaluation more honest.

## Why We Train One Model Per Sensor

The pipeline trains separate models for each `sensor_id`.

This decision was made because the sensors can have completely different meanings and scales:

- kWh electricity consumption.
- Natural gas volume.
- Temperature.
- Pressure.
- Water or flow readings.
- Production or efficiency indicators.

A single global model would have to learn all of these behaviors at once. That is possible, but it adds complexity: sensor embeddings, unit normalization, scale differences, and more careful validation. A per-sensor model is simpler, easier to debug, and easier to serve.

Per-sensor modeling also matches the cleaning output. The cleaned data is stored in long format:

```text
timestamp, sensor_id, value, unit, source_file, source_sheet, source_row
```

This makes it easy to filter one sensor and train the same code path for every sensor.

## Time-Series Preprocessing

The ML pipeline has four main preprocessing stages for the tri-generation data.

### 1. Raw Excel Inspection

Before cleaning, the script `inspect_tri_gen.py` inspects each raw workbook and sheet. It detects:

- Sheet names.
- Row and column counts.
- The likely header row.
- The likely date column.
- Numeric sensor columns.
- Units in column labels such as kWh, MWh, m3, Nm3, degC, bar, kg, or tCO2.
- Suspected duplicate files such as browser-downloaded copies ending in `(1).xlsx`.

We do this because industrial Excel files are rarely clean. Headers may start on row 4 or row 8, dates may be in different columns, and units may be embedded inside human-readable column names. Inspecting first avoids writing blind cleaning logic.

### 2. Cleaning Into Long Format

The script `clean_tri_gen.py` converts the raw monthly Excel reports into a canonical long Parquet table.

Important cleaning operations include:

- Reading the inspection report instead of guessing sheet structure again.
- Coercing dates into real timestamps.
- Coercing French-style numbers such as `1 234,56` into floats.
- Slugifying sensor labels into stable `sensor_id` values.
- Keeping source provenance: file name, sheet name, and source row.
- Dropping rows with unparseable dates.
- Dropping duplicate `(timestamp, sensor_id)` rows.
- Writing one Excel file per sensor for teammates who need domain-level review.

The long format is chosen because it is ML-friendly. Wide Excel tables are comfortable for humans, but they are harder for modeling because every column has a different meaning. Long format gives us a consistent schema for every sensor.

### 3. Feature Engineering

The script `build_features.py` creates `features.parquet` from `long.parquet`.

It adds three families of features:

#### Calendar Features

Calendar features describe where a timestamp falls in the day, week, and year:

- `hour`
- `dow`
- `dom`
- `month`
- `is_weekend`
- `dow_sin`, `dow_cos`
- `hour_sin`, `hour_cos`
- `month_sin`, `month_cos`

The sine and cosine features are used because time is cyclic. For example, hour 23 and hour 0 are close in real life, but plain integer encoding makes them look far apart. Sine/cosine encoding fixes that.

#### Lag Features

Lag features give the model previous values:

- Daily lags: `1, 2, 3, 7, 14, 28`
- Hourly lags: `1, 2, 3, 24, 48, 168`

These features are the core of the forecasting model. They turn the task from:

```text
predict value now
```

into:

```text
predict value now using recent values, yesterday, last week, and longer history
```

#### Rolling Features

Rolling features summarize recent behavior:

- Daily rolling windows: `7, 14, 28`
- Hourly rolling windows: `24, 168`

For each window, the pipeline computes rolling mean and rolling standard deviation.

The implementation shifts by one step before rolling, so the current target value is not included in its own features. This prevents data leakage.

### 4. Temporal Train/Validation/Test Split

The pipeline uses time-based splitting:

- Test set: last 14 days.
- Validation set: 14 days before the test set.
- Train set: everything before validation.

For short datasets, it falls back to proportional splits.

We never randomly shuffle time-series data because random splitting leaks the future into the past. The model must be evaluated on data that happens after the data it learned from.

## LightGBM Training Details

The LightGBM model uses:

| Parameter | Value | Reason |
|---|---:|---|
| Objective | `regression_l1` | Aligns training with MAE, which is robust to spikes |
| Metric | `mae` | Easy to interpret in the original unit |
| Learning rate | `0.05` | Stable training without being too slow |
| Num leaves | `31` | Good default complexity for small to medium tabular data |
| Min data in leaf | `5` | Allows learning from small datasets |
| Feature fraction | `0.9` | Adds regularization by sampling features |
| Bagging fraction | `0.9` | Adds regularization by sampling rows |
| Boosting rounds | `500` | Upper limit |
| Early stopping | `30` rounds | Stops when validation performance no longer improves |

The model writes:

- `model.lgb`
- `feature_columns.json`
- `metadata.json`
- `forecast_test.csv`
- MLflow metrics and artifacts

The metadata includes cadence, row counts, selected lags, rolling windows, feature count, best iteration, baseline metrics, LightGBM metrics, and top feature importances.

## Forecasting Metrics

The evaluation uses:

- MAE: mean absolute error.
- RMSE: root mean squared error.
- MAPE: mean absolute percentage error.
- sMAPE: symmetric mean absolute percentage error.

MAE and sMAPE are the most useful pair for this project.

MAE is easy to explain because it is in the same unit as the sensor. If the sensor is kWh, the error is also in kWh.

sMAPE is safer than MAPE when values are close to zero. Energy datasets can contain zeros or near-zeros, and plain MAPE can explode in those cases.

## Why We Use Rolling MAD for Anomaly Detection

Rolling MAD means rolling median absolute deviation. It measures how far the current value is from the recent local median.

The modified z-score is:

```text
0.6745 * (x - median) / MAD
```

The pipeline flags a value when:

```text
abs(mad_z) >= 3.5
```

Rolling MAD was chosen because it is:

1. Explainable.
   We can say, "this point is far away from recent normal behavior."

2. Robust to outliers.
   Median and MAD are less distorted by spikes than mean and standard deviation.

3. Suitable for streaming.
   It can run with a rolling window and does not require retraining.

4. Edge-friendly.
   This method is simple enough to port to ESP32-style hardware for on-device anomaly detection.

Rolling MAD is especially good for spikes, dropouts, frozen sensors, and sudden jumps.

## Why We Use IsolationForest for Anomaly Detection

Rolling MAD only looks at local deviation in the raw value. IsolationForest adds another view: it looks for rare combinations of value, calendar context, lag features, and rolling statistics.

For example, a consumption value may not be extreme by itself, but it may be unusual at 3 AM on a Sunday. IsolationForest can catch that kind of compound anomaly.

The configured IsolationForest uses:

| Parameter | Value | Reason |
|---|---:|---|
| `n_estimators` | `200` | Stable anomaly scores |
| `contamination` | `auto` | Avoids hardcoding anomaly rate before seeing the data |
| `random_state` | `42` | Reproducibility |
| `n_jobs` | `-1` | Use available CPU cores |

The final anomaly flag is fused:

```text
any_flag = iforest_flag OR mad_flag
```

This gives us a practical detector that catches both obvious point anomalies and more subtle contextual anomalies.

## Document Ingestion and Preprocessing

The document pipeline handles:

- Native PDFs.
- Scanned PDFs.
- Scanned images such as JPEG and PNG.
- Excel workbooks.

The first step is file type detection. The system checks the extension and magic bytes, then classifies the document as:

- `native_pdf`
- `scanned_pdf`
- `scanned_image`
- `excel`
- `unknown`

For PDFs, it looks for text markers to decide whether the PDF probably has selectable text. Native PDFs go directly to text extraction. Scanned PDFs and images go through OCR.

## Image Preprocessing for OCR

Scanned bills and phone photos are noisy. OCR quality depends heavily on image quality, so preprocessing is required before Tesseract.

The preprocessing service uses Sharp and applies:

1. Grayscale conversion.
   Color is usually not necessary for text recognition. Grayscale reduces noise and simplifies the OCR input.

2. Upscaling small images.
   If the long edge is below 1500 pixels, the image is resized upward using Lanczos interpolation. Small text becomes easier for OCR to read.

3. Contrast normalization.
   The image contrast is stretched so faint text becomes more visible.

4. Median denoising.
   A light median filter reduces small artifacts without destroying text edges.

5. Thresholding.
   The image is binarized into black text on a white background, which is a strong input format for OCR.

6. PNG output.
   The processed image is sent to Tesseract as a clean PNG buffer.

Full deskew is not implemented in this pure JavaScript pipeline. Minor skew is left to Tesseract, which can handle small rotations. This was a time-conscious decision: OpenCV-style deskew would add more native dependency complexity.

## Why Tesseract.js With French and Arabic

The OCR engine is Tesseract.js with the default language setting:

```text
fra+ara
```

This choice matches Tunisian utility documents. Many bills and audits are primarily in French, but Arabic can appear in headers, addresses, labels, or stamps.

Tesseract.js was chosen because:

- It runs locally.
- It does not require a cloud OCR provider.
- It supports French and Arabic.
- It gives confidence scores.
- It gives word-level bounding boxes for provenance.
- It can be benchmarked in automated tests.

OCR results are cached by SHA-256 hash of the raw image buffer, so repeated uploads do not waste time.

## Why We Use an LLM for Structured Extraction

OCR gives raw text, not structured data. The challenge needs structured fields like supplier, account number, billing period, consumption, unit, amount, currency, and energy type.

The project uses Claude Sonnet through LangChain with structured output and Zod schemas.

The default configured model is:

```text
claude-sonnet-4-20250514
```

The LLM is used with temperature `0` to make extraction deterministic and reduce creative variation.

This decision was made because invoices and audit documents are semi-structured. Rules alone would be fragile across:

- Different bill layouts.
- OCR mistakes.
- French labels.
- Arabic labels.
- Multi-page PDFs.
- Missing or optional fields.
- Different suppliers and utility types.

The LLM acts as a flexible parser, while Zod schemas keep the output constrained.

## Why We Validate With Zod Schemas

The pipeline does not accept free-form LLM output directly. Each extraction is validated against a schema.

For bills, the schema covers:

- Supplier.
- Account number.
- Customer details.
- Billing period.
- Consumption value.
- Consumption unit.
- Normalized `consumption_kwh`.
- Amount before tax.
- TVA.
- Amount including tax.
- Currency.
- Tariff and voltage class.
- Energy type.
- Line items.
- Extraction confidence.

For Excel reports, the schema covers:

- Timestamp or period label.
- Month and year.
- Source name and source ID.
- Energy type.
- Consumption value and unit.
- Normalized kWh.
- Production values.
- Cost.
- Efficiency and COP.
- Sheet and row provenance.

Validation gives us:

- A pass/fail signal.
- Missing field lists.
- Consistency warnings.
- A quality score.

For example, the bill validator checks whether:

```text
amount_ht + tva_amount ~= amount_ttc
```

It also checks that the billing period end date is after the start date.

## Unit Normalization

The schemas are designed around normalized energy values, especially:

```text
consumption_kwh
```

This is important because the raw documents may report energy in different units:

- kWh
- MWh
- gas volume such as m3 or Nm3
- thermal or production units
- water or fuel-related quantities

Normalizing to kWh gives the rest of the system one common unit for forecasting, CO2 estimation, dashboards, and comparison between sources.

The key idea is that extraction should preserve the original value and unit, but also produce a normalized field for downstream computation.

## Excel Extraction Decisions

Excel files are handled differently from scanned documents. We do not OCR Excel. We parse the workbook directly with SheetJS.

The pipeline:

1. Reads the workbook from the uploaded buffer.
2. Iterates through sheets.
3. Converts each sheet to raw rows.
4. Uses LLM-assisted header detection on the first rows.
5. Extracts structured energy entries from each sheet.
6. Validates the entries with Zod.
7. Stores header row choices and parsing warnings.

This approach was chosen because Excel files often have irregular formatting. Headers may not start on the first row, and sheets may use human-friendly report layouts rather than database-like tables.

## Caching Decisions

The document extraction pipeline caches:

- OCR results.
- Bill extraction results.
- Excel extraction results.

The cache key is based on SHA-256 of the original file or image buffer.

This matters because OCR and LLM calls are expensive compared with normal API logic. During demos and benchmarks, the same documents are often uploaded multiple times. Caching makes the app faster and protects against unnecessary API usage.

## Why We Did Not Use a Large Neural Time-Series Model First

The repository mentions foundation time-series models such as Chronos and TimesFM as possible research directions. However, the implemented competition pipeline uses LightGBM first.

That is intentional.

Large neural forecasting models are attractive, but they introduce risks:

- More setup complexity.
- More dependency risk.
- More training and tuning time.
- Harder explainability.
- Harder edge deployment.
- Worse performance than tree models on small structured datasets.

For the current data and timeline, LightGBM is the safer first model. It gives us a strong baseline fast. If later we have more time and more data, Chronos or another foundation model can be compared against the current LightGBM leaderboard.

## Why We Did Not Use Only an LLM for Everything

LLMs are useful for document extraction, but they are not the right tool for every task.

For numerical forecasting and anomaly detection, classical ML is better because:

- It is cheaper at inference time.
- It is deterministic.
- It can run offline.
- It can be evaluated directly with MAE, sMAPE, and event counts.
- It can be ported or approximated on edge devices.

The final architecture uses each model where it makes sense:

- LLMs for messy language and document structure.
- LightGBM for tabular forecasting.
- Rolling MAD and IsolationForest for anomaly detection.
- OCR for image-to-text conversion.

## Reproducibility and Auditability

The pipeline stores enough metadata to make results auditable:

- Raw source file names.
- Source sheets and source rows.
- SHA-256 hashes of source files.
- Cleaning logs.
- Feature manifests.
- Model metadata.
- Feature column order.
- Forecast test predictions.
- Anomaly event timelines.
- MLflow runs.
- OCR confidence.
- Extraction quality scores.

This is important because the project is not only a demo. It is an industrial data pipeline, and industrial users need to know where every number came from.

## Summary

The project choices are deliberately practical:

- LightGBM is used because it is fast, strong on engineered time-series tables, explainable, and reliable with limited data.
- Seasonal-naive forecasting is used as a reality-check baseline.
- One model per sensor keeps units, scales, and behavior easy to reason about.
- Rolling MAD catches simple local anomalies and can run on edge hardware.
- IsolationForest catches more contextual anomalies.
- Excel data is inspected and cleaned into long format before modeling.
- Calendar, lag, and rolling features give the models the time context they need.
- Images are preprocessed before OCR to improve text quality.
- Tesseract.js with French and Arabic matches the expected Tunisian documents.
- Claude Sonnet structured extraction is used for flexible parsing, but Zod schemas and validation keep outputs controlled.
- Caching and metadata make the system faster, reproducible, and easier to defend.

The result is a system that balances model performance with explainability, implementation speed, and robustness to messy real-world industrial data.
