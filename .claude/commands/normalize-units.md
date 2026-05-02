---
description: Normalize a JSON of energy entries to canonical kWh with traceable conversion factors
argument-hint: <input-json> [<output-json>]
allowed-tools: Read, Write, Edit, Bash
---

# /normalize-units — kWh canonicalization with provenance

For Part 2 §2.1 (25 pts unit-normalization). Pure transform, no LLM.

## Arguments
- `<input-json>` — list of `{quantity, unit, ...}` records.
- `<output-json>` (optional) — defaults to `<input>.normalized.json`.

## What this does

Calls `apps/doc-extraction/src/validation/units.py::to_kwh` per row. Adds:
- `canonical_kwh` (float)
- `conversion_factor` (the constant used)
- `factor_source` (e.g. "ADEME 2024", "audit PDF Section I-1")

Refuses unknown units rather than guessing — they go to a `units_unknown` bucket for the team to review.

Owner agent: `energy-domain-engineer`.
