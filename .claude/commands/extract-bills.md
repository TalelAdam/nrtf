---
description: Run the document-extraction pipeline against a directory of bills and produce a normalized Parquet
argument-hint: <input-dir> [<output-parquet>]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# /extract-bills — heterogeneous documents → normalized table

End-to-end Part 2 §2.1 + §2.2 pipeline for one input directory.

## Arguments
- `<input-dir>` — folder containing PDFs / JPEGs / Excel files (e.g. `data/raw/factures/`).
- `<output-parquet>` (optional) — sink path; defaults to `data/processed/extracted_<dir>.parquet`.

## What this does

1. List files; classify each as native-PDF / scanned-image / Excel.
2. Run the appropriate extractor (`document-intelligence-engineer`'s pipeline). Cache by file SHA.
3. LLM-assisted field extraction with Pydantic schema constraints (`EnergyBill` etc.).
4. Validate (Pydantic + cross-field math: `total_ht + tva ≈ total_ttc`, `period_end > period_start`).
5. Hand off to `energy-domain-engineer`'s normalizer → `canonical_kwh` + `co2_kg` + `scope` per row.
6. Write Parquet, partitioned by `supplier` + `year_month`.
7. Print: total rows, schema-pass rate, total kWh, total CO₂, list of failed files.
8. Optionally POST to the challenge platform (if endpoint configured in `.env`).

## Output

A Polars-readable Parquet at the configured path, plus an `extraction_failures.parquet` next to it.

Owner agents: `document-intelligence-engineer` (extraction), `energy-domain-engineer` (units + CO₂).
