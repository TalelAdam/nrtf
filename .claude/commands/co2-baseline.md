---
description: Compute CO₂ emissions from a normalized energy frame, by carrier and total, with cited factors
argument-hint: <input-parquet-or-json> [<output-report>]
allowed-tools: Read, Write, Edit, Bash
---

# /co2-baseline — Part 2 §2.2 CO₂ estimation

For Part 2 §2.2 (15 pts CO₂ estimation quality).

## Arguments
- `<input>` — the output of `/normalize-units` or `/extract-bills`.
- `<output-report>` (optional) — markdown report path; defaults to `data/processed/co2_report_<ts>.md`.

## What this does

Per-row:
- Tag carrier (electricity / natural_gas / fuel_oil / lpg / diesel) by supplier whitelist.
- Apply emission factor from `apps/doc-extraction/src/validation/emissions.py` (ADEME 2024 + STEG 2023 for the TN grid).
- Compute `co2_kg` and tag scope (1, 2, 3).
- Bracket the result: best-case / base / conservative.

Aggregates:
- Total tCO₂/yr.
- Per-carrier breakdown (sankey-ready JSON).
- Per-month time series (forecast-ready).

Reconciles against the audit's energy balance (Σ inputs ≈ Σ outputs + Σ losses ± 5%). Flags discrepancies > 5%.

Owner agent: `energy-domain-engineer`.
