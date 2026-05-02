---
description: Walk the audit + Excel reports, identify waste-heat sources, score them, output the top-3 scenarios
argument-hint: [<audit-pdf>] [<output-xlsx>]
allowed-tools: Read, Write, Edit, Bash
---

# /heat-recovery-scan — Track B inventory + MCDA + ROI

For Re·Tech Fusion Part 3 Track B (75 + 15 bonus pts).

## Arguments
- `<audit-pdf>` (optional) — defaults to `data/raw/audit/rapport_audit.pdf`.
- `<output-xlsx>` (optional) — defaults to `apps/heat-recovery/scenarios/top3.xlsx`.

## What this does

1. **Identify** — parse audit Sections I-3 (Énergies Perdues) and I-4 (Énergies Récupérées), tag each flow.
2. **Characterize** — for each candidate source, compute Q_recoverable, T-level, hours/yr, location.
3. **Match** — Pinch-light source-to-sink (boiler feedwater pre-heat, ECS, absorber drive heat, HVAC).
4. **Score** — MCDA weighted-sum (energy 30 / CO₂ 25 / complexity 20 / capex 15 / payback 10).
5. **Top-3** — write each as a one-page scenario card with bracketed ROI numbers (best / base / conservative).

## Output

- `apps/heat-recovery/scenarios/top3.xlsx` — sorted scored table (deck-ready).
- `apps/heat-recovery/scenarios/<scenario_id>/description.md` — one card per top-3 scenario.
- `apps/heat-recovery/scenarios/inventory.parquet` — full inventory of identified sources (for the deck appendix).

Owner agents: `energy-domain-engineer` (lead), `data-engineer` (audit parsing), `document-intelligence-engineer` (audit OCR fallback).
