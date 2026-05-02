# apps/heat-recovery

Re·Tech Fusion **Part 3 — Track B** deliverable. Systematic identification, characterization, and prioritization of waste-heat recovery opportunities for an industrial site.

## What this app produces

1. **Heat-source inventory** — pulled from the audit PDF + Excel reports + IoT readings, one row per identified source.
2. **Characterization** — temperature level, thermal flux (kW), availability profile, location.
3. **Multi-criteria score** — recoverable energy, CO₂ reduction, integration complexity, implementation cost, ROI.
4. **Top-3 recovery scenarios** — quantified impact (kWh/yr saved, tCO₂/yr avoided, payback months).
5. **(Bonus)** Interactive notebook + scored spreadsheet output.

## Folder layout

```
apps/heat-recovery/
├── src/
│   ├── identify.py        # parse audit + Excel for heat sources
│   ├── characterize.py    # thermal flux, T-level, availability
│   ├── score.py           # MCDA: weighted sum / TOPSIS / AHP
│   ├── roi.py             # capex/opex, payback, NPV
│   └── report.py          # spreadsheet + markdown report generators
├── scenarios/             # one folder per scoped recovery scenario
│   └── <scenario>/
│       ├── description.md
│       ├── calc.ipynb
│       └── numbers.json
└── data/                  # link to data/raw/audit/ + tri-gen Excel
```

## Method (Track B canonical recipe)

1. **Identify** sources from the audit (chimney flue gas, condensate not recovered, hot surfaces, compressed-air heat-of-compression, exhaust ventilation, cooling water from absorber, etc.).
2. **Quantify** each: `Q_recoverable [kW] = ṁ × Cp × ΔT × η_HX × utilization_hours`.
3. **Match** sources to sinks (HVAC pre-heat, ECS, boiler feedwater pre-heat, absorption chiller).
4. **Score** with MCDA weights (default: 30% energy, 25% CO₂, 20% complexity, 15% capex, 10% ROI months).
5. **Rank** and pick top-3; write each as a one-page scenario card with numbers.

Owner agents: `energy-domain-engineer` (lead), `data-engineer` (audit parsing).

## Pre-hackathon homework (Day 1, before Part 3 drops)

The Chem/Bio teammates can start NOW from `data/raw/audit/rapport_audit.pdf`. The audit already names ≥ 8 candidate sources (Section I-3 "Energies Perdues" + I-4 "Energies Recuperees"). Build the inventory + ROI templates today; on Day 2 just plug in the test-set numbers.
