---
name: anomaly-detection-timeseries
description: Use when detecting anomalies in IoT sensor streams or energy meter readings — stuck sensor, spike, dropout, drift, level-shift, seasonal anomaly. Methods: rolling z-score, MAD, EWMA control limits, STL decomposition, IsolationForest, residual-from-forecast. Designed to also run on ESP32 for Track A on-device anomaly. Trigger on "detect anomalies", "stuck sensor", "spike detection", "sensor fault", "anomaly score", "ESP32 anomaly".
---

# Time-series Anomaly Detection (server + ESP32)

For Part 2 bonus (+15 pts) and Part 3 Track A (anomaly without server contact). Same algorithms; one runs on the laptop, a tiny version runs on the ESP32.

## Anomaly taxonomy (the spec lists these)

| Type | Signature | Default detector |
|---|---|---|
| **Stuck** | std(window) ≈ 0 over N steps | `rolling_std < ε` (≥ 30 samples, ε = 0.001 × range) |
| **Spike** | one-sample deviation \| robust z \| > 4 | rolling-MAD z-score |
| **Dropout** | gap in timestamps > 2 × median Δt | gap detector |
| **Drift** | slow level change against historical baseline | EWMA vs reference window |
| **Level-shift** | persistent step (CUSUM/PELT) | CUSUM with positive + negative arms |
| **Seasonal** | residual-from-STL deviation | STL → IsolationForest on residuals |

## Server-side recipe (Part 2 anomaly bonus)

```python
import polars as pl, numpy as np
def rolling_mad_z(series: pl.Series, window: int = 60) -> pl.Series:
    med = series.rolling_median(window)
    mad = (series - med).abs().rolling_median(window)
    return ((series - med) / (1.4826 * mad.clip_min(1e-9))).abs()

def detect_anomalies(df: pl.DataFrame, sensor_col: str, ts_col: str = "ts"):
    s = df.get_column(sensor_col)
    z = rolling_mad_z(s, window=60)
    rolling_std = s.rolling_std(30)
    median_dt = (df.get_column(ts_col).diff().dt.seconds()).median()
    gaps = df.get_column(ts_col).diff().dt.seconds() > 2 * median_dt
    return df.with_columns([
        (z > 4).alias("is_spike"),
        (rolling_std < 1e-3).alias("is_stuck"),
        gaps.alias("is_dropout"),
    ])
```

For richer detection: STL decomposition (`statsmodels.tsa.seasonal.STL`) → residuals → `sklearn.ensemble.IsolationForest(contamination="auto")`. Combine via OR over detector outputs.

## On-device recipe (ESP32, Track A)

You only get O(KB) RAM and you must be deterministic. Drop IsolationForest; keep rolling-MAD + stuck-detector + dropout-detector.

```c
// Ring buffer of the last N samples
#define N 32
static float buf[N]; static uint8_t head = 0; static uint8_t filled = 0;
static const float Z_THRESH = 4.0f;
static const float STUCK_EPS = 0.001f;
static uint32_t last_ts_ms = 0;
static const uint32_t MAX_GAP_MS = 5000;

float rolling_median(const float* a, int n);  // implemented with insertion sort, n ≤ 32
float rolling_mad(const float* a, int n, float med);

bool process(float x, uint32_t ts_ms, char* reason_out, size_t out_len) {
  // dropout
  if (last_ts_ms != 0 && ts_ms - last_ts_ms > MAX_GAP_MS) {
    snprintf(reason_out, out_len, "dropout"); last_ts_ms = ts_ms; return true;
  }
  last_ts_ms = ts_ms;
  buf[head] = x; head = (head + 1) % N; if (filled < N) filled++;

  if (filled < N) return false;
  float med = rolling_median(buf, N);
  float mad = rolling_mad(buf, N, med);
  float std_proxy = mad * 1.4826f;
  if (std_proxy < STUCK_EPS) { snprintf(reason_out, out_len, "stuck"); return true; }
  float z = fabsf((x - med) / (std_proxy + 1e-9f));
  if (z > Z_THRESH) { snprintf(reason_out, out_len, "spike z=%.1f", z); return true; }
  return false;
}
```

This compiles to ~ 4 KB. RAM: 32 × 4 = 128 B + temp buffer for sort. Latency: < 50 µs on ESP32 @ 240 MHz.

## Forecast-residual anomaly (server, Part 3A predictive model)

The predictive model from `ml-pipeline` outputs `y_hat`. Anomaly = `|y - y_hat| / σ_residuals > 3`. This is the strongest signal but requires a working forecaster.

```python
residuals = df["y"] - df["y_hat"]
sigma = residuals.tail(500).std()
df = df.with_columns(((residuals / sigma).abs() > 3).alias("is_residual_anomaly"))
```

## Confidence score (per the spec)

Each detected anomaly must include `type`, `timestamp`, `sensor/site`, `confidence`. Compute confidence as:
- spike: `min(1.0, (z - 4) / 4)` — capped 1.0 when z ≥ 8
- stuck: `min(1.0, dwell_in_stuck / 10_periods)` — longer = more confident
- dropout: `1.0` after 2 × median Δt
- drift: function of CUSUM accumulator vs threshold
- residual: `min(1.0, (|res|/σ - 3) / 3)`

## Output schema

```json
{"sensor_id": "esp32-flow-01", "metric": "flow_lpm", "ts": "2026-05-02T11:23:14Z",
 "type": "spike", "value": 412.7, "expected": 38.2, "confidence": 0.92}
```

Persist these as a `events` table in TimescaleDB (already in the schema).

## Things NOT to do

- Don't use `mean ± 3σ` for outlier detection on industrial data — outliers contaminate the mean. Use median + MAD.
- Don't run a heavy scikit-learn model on the ESP32. The C ring-buffer + median + MAD is enough.
- Don't mark a single missing sample as a dropout. Require ≥ 2 × median Δt.
- Don't tune thresholds on the test set. Use a held-out window from training data.

## Hackathon shortcut

For server-side: `from sktime.detection import STRAY` or `pyod.models.iforest.IForest` — one import, one fit, decent baseline. Spec only needs *detection*, not best-in-class.
