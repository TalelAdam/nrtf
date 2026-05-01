---
name: large-data-pipeline
description: Use when the dataset is too big for pandas or when designing the storage layout for the leaked KILANI dataset — Polars lazy/streaming, DuckDB, Parquet partitioning, Arrow, webdataset shards, Ray Data. Trigger on "the dataset is X GB", "convert to Parquet", "shard videos", "DuckDB query", "Polars lazy", "streaming dataset", "data layout", "partition this".
---

# Large-Data Pipeline Patterns

Companion to `data-engineer`. The default toolchain when the leaked dataset is too big to load into pandas.

## Storage layout principles

1. **Parquet, snappy or zstd, partitioned.** One file per logical shard, ≤ 256 MB. Partition by date / camera / sensor.
2. **Hive-style partition keys.** `data/processed/sensors.parquet/device=esp32-batt-01/date=2026-04-15/part-0.parquet`.
3. **Manifest per dataset.** `_manifest.json` lists shards, SHAs, row counts, schema version, build timestamp.
4. **Streaming shards for video / images.** `webdataset` tar shards (`shard-000000.tar`) at ~ 1 GB each.

## Polars lazy + streaming

```python
import polars as pl

q = (
    pl.scan_parquet("data/processed/sensors.parquet/**/*.parquet")
      .filter(pl.col("ts").is_between("2026-04-01", "2026-04-30"))
      .filter(pl.col("metric") == "particles_pm2_5")
      .group_by_dynamic("ts", every="5m", group_by=["device_id"])
      .agg([
          pl.col("value").mean().alias("mean"),
          pl.col("value").max().alias("max"),
          pl.col("value").quantile(0.95).alias("p95"),
      ])
      .sort(["device_id", "ts"])
)
df = q.collect(engine="streaming")  # multi-core, out-of-core
```

Streaming engine spills to disk when needed. Will handle 100 GB+ on a laptop.

## DuckDB straight on Parquet — no ETL

```python
import duckdb
con = duckdb.connect()
con.execute("PRAGMA threads=8")
con.execute("PRAGMA memory_limit='8GB'")
df = con.sql("""
  SELECT camera_id,
         date_trunc('hour', ts) AS hour,
         count(*)               AS frames,
         avg(num_persons)       AS avg_persons,
         max(num_persons)       AS peak
  FROM read_parquet('data/processed/frame_index.parquet/**/*.parquet')
  WHERE date_trunc('day', ts) = '2026-04-15'
  GROUP BY 1, 2
  ORDER BY 1, 2
""").pl()
```

DuckDB query planner pushes predicates down to Parquet metadata — only relevant row groups are read. 30 M rows in a few hundred ms.

## CSV → Parquet conversion (typical ingestion)

```python
import polars as pl
pl.scan_csv("data/raw/kilani_leak_v1/sensors/*.csv",
            try_parse_dates=True,
            schema_overrides={"value": pl.Float64})\
  .with_columns(pl.col("ts").dt.date().alias("date"))\
  .sink_parquet(
      "data/processed/sensors.parquet",
      compression="zstd",
      partition_by=["device_id", "date"],
  )
```

`sink_parquet` is the streaming write — never materializes the full frame in memory.

## Webdataset shards (video / images for training)

```bash
# Build shards from a frame directory
mkdir -p data/processed/video_shards
python -m webdataset.tariterators \
  --input-dir data/processed/labels/ppe/train \
  --output data/processed/video_shards/shard-%06d.tar \
  --maxsize 1e9
```

```python
# Stream-train without ever materializing the dataset
import webdataset as wds
ds = (wds.WebDataset("data/processed/video_shards/shard-{000000..000049}.tar")
        .decode("rgb")
        .to_tuple("jpg", "json")
        .map_tuple(transform_image, parse_label)
        .batched(32))
loader = torch.utils.data.DataLoader(ds, num_workers=8)
```

Scales linearly with shard count and worker count. No random-access seeking penalty.

## Time-series rollups in TimescaleDB (continuous aggregates)

```sql
-- 1-minute rollup
CREATE MATERIALIZED VIEW readings_1m
WITH (timescaledb.continuous) AS
SELECT device_id, metric,
       time_bucket('1 minute', ts) AS bucket,
       avg(value) AS mean, max(value) AS max,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY value) AS p95
FROM readings
GROUP BY 1, 2, 3;

SELECT add_continuous_aggregate_policy('readings_1m',
  start_offset => INTERVAL '7 days',
  end_offset   => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute');

-- Retention: keep raw 7 days, 1-min 90 days, 1-hour forever
SELECT add_retention_policy('readings',    INTERVAL '7 days');
SELECT add_retention_policy('readings_1m', INTERVAL '90 days');
```

## Ray Data — when laptop isn't enough

Use only when the dataset truly exceeds laptop disk + > 1 hour of compute.

```python
import ray
ds = ray.data.read_parquet("s3://bucket/sensors.parquet/")
out = (ds.filter(lambda r: r["metric"] == "particles_pm2_5")
         .map_batches(featurize, batch_format="pyarrow")
         .write_parquet("s3://bucket/features/"))
```

## Manifest contract

Every dataset under `data/processed/<name>/` has:

```json
{
  "name": "kilani_leak_v1__sensors",
  "version": "1.0.0",
  "schema_path": "apps/ml-pipeline/src/schemas/sensors.py",
  "transform_script_sha": "abc123...",
  "source_sha": "def456...",
  "row_count": 47832119,
  "shard_count": 312,
  "build_ts": "2026-04-30T18:42:11Z",
  "partition_keys": ["device_id", "date"]
}
```

Models log this manifest's path in MLflow as `data_version`.

## Things NOT to do

- Don't load > 1 GB into pandas. Use Polars or DuckDB.
- Don't write a feature transform that fits in pandas-eager-mode but breaks at scale. Make it lazy from day one.
- Don't generate splits via `df.sample(frac=0.2, random_state=42)`. Materialize the split file once, commit it.
- Don't reach for Spark on a 30 GB dataset. DuckDB beats it on a laptop.
- Don't store raw video at 4K when training uses 640×640. Pre-resize on ingestion.
- Don't forget `try_parse_dates=True` — string timestamps will silently sabotage groupings.

## Hackathon shortcuts

- One-shot transform: `duckdb -c "COPY (SELECT ... FROM read_parquet('in.parquet')) TO 'out.parquet'"`.
- Frame extraction: `ffmpeg -i video.mp4 -vf fps=2 -q:v 2 frames/%06d.jpg` (faster than any python).
- Single-machine training: `mosaicml-streaming` is the simplest path to streaming PyTorch dataloading.
