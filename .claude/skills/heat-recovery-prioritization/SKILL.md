---
name: heat-recovery-prioritization
description: Use for Re·Tech Fusion Part 3 Track B — systematic identification, characterization, and prioritization of waste-heat recovery opportunities for an industrial site. Methods: Pinch-style source-to-sink matching, multi-criteria decision analysis (weighted-sum / TOPSIS / AHP), recoverable energy formulas, ROI / payback / NPV calculations. Trigger on "Track B", "waste heat", "heat recovery", "MCDA", "Pinch analysis", "ROI scenarios", "energy savings".
---

# Track B — Waste-Heat Recovery Prioritization

The companion to `energy-domain-engineer`. The `apps/heat-recovery/` deliverable is built on this recipe.

## The five-step canonical method

1. **Identify** — walk the audit + Excel reports + IoT readings, list every flow with `T_out > T_ambient + 30 °C` and `is_recovered=False`.
2. **Characterize** — for each source, compute `Q_recoverable [kW]`, T-level, hours/yr, location.
3. **Match** sources to candidate sinks (Pinch-style cascade — high-T sources drive high-T sinks first).
4. **Score** with MCDA — energy / CO₂ / complexity / capex / payback, weighted-sum or TOPSIS.
5. **Quantify** the top-3 with full ROI numbers.

## Step 1 — Identify (heat-source inventory)

Source classes (memorize):

| Class | Typical T | Typical recovery |
|---|---|---|
| Boiler / chimney flue gas | 180–350 °C | economiser → feedwater pre-heat |
| Furnace / oven exhaust | 300–700 °C | air pre-heater, steam generator |
| Tri-gen engine exhaust | 400–500 °C | exhaust HX → hot water / steam (mostly already done; check absorber heat-up) |
| Engine jacket water | 85–105 °C | hot-water HX (often recovered) |
| Steam condensate (not returned) | 60–95 °C | direct return to boiler feedwater (the easiest win — pumps + lines only) |
| Compressed-air heat-of-compression | 60–90 °C | ECS pre-heat, space heating |
| Refrigeration / chiller condenser | 30–45 °C | space heating in winter only (low-grade) |
| Industrial dryer exhaust | 80–150 °C | air-to-air HX |
| Hot effluent water | 30–60 °C | HX to incoming process water |
| Hot surfaces (uninsulated valves, pipes, tanks) | varies | insulation upgrade — counts as recovery via avoided loss |

For our pharma audit specifically, Section I-3 names: chimney exhaust (boilers + tri-gen), uncondensed steam, hot surfaces, compressors. Section I-4 names: tri-gen recuperation already in place. **Pre-build the inventory NOW** from `data/raw/audit/rapport_audit.pdf` — don't wait for Day 2.

## Step 2 — Characterize each source

```
Q_recoverable [kW]   = ṁ [kg/s] × Cp [kJ/kg·K] × (T_source - T_target) [K] × η_HX
```

| Fluid | Cp (kJ/kg·K) |
|---|---:|
| Air (dry, 100 °C) | 1.006 |
| Combustion flue gas | 1.05 |
| Water | 4.186 |
| Steam (saturated, 5 bar) | 2.09 (h_fg ≈ 2096 kJ/kg) |
| Engine oil | 1.9 |

Default heat-exchanger efficiencies: economiser 0.80, gas-water HX 0.85, gas-air HX 0.65, water-water HX 0.92.

Available hours: process operating hours per year × CF (capacity factor, 0.6–0.9 for pharma).

```
E_recoverable [kWh/yr] = Q_recoverable × hours × CF
```

## Step 3 — Match sources to sinks (Pinch-light)

Cleanly: high-T sources → high-T sinks first. Don't waste 300 °C exhaust on heating tap water.

Common sinks in our audit:
- Boiler feedwater pre-heat: 80 °C in → 105 °C out (every steam-gas system)
- ECS (eau chaude sanitaire): 15 °C in → 50 °C out (~40 kW demand typical)
- Process hot water (Zone Alpha/Gamma): 60–75 °C
- Absorption chiller drive heat: 95 °C input
- Building heating in winter only (limited hours)

A source matches a sink iff `T_source - T_pinch ≥ T_sink_out + ΔT_min` with `ΔT_min ≈ 10 K` for liquid-liquid, 20 K for gas-liquid. Sources that can't match any sink go to "insulation / loss reduction" bucket.

## Step 4 — Score with MCDA

Default weights (defensible in Q&A):
- 30% **Energy savings** (kWh/yr)
- 25% **CO₂ reduction** (tCO₂/yr)
- 20% **Integration complexity** (1 = easy, 5 = hard, *inverted*)
- 15% **Capex** (kDT, *inverted log-scale*)
- 10% **Payback** (months, *inverted*)

Weighted-sum (TOPSIS works too; AHP is overkill for 8-12 scenarios).

```python
import polars as pl, numpy as np

def score(df: pl.DataFrame, weights: dict[str, float]) -> pl.DataFrame:
    # Normalize each criterion to [0,1]; invert direction where lower-is-better
    norm_cols = []
    for col, (direction, weight) in weights.items():
        s = df.get_column(col)
        rng = (s.max() - s.min()) or 1.0
        z = (s - s.min()) / rng
        if direction == "min":
            z = 1.0 - z
        norm_cols.append((z * weight).alias(f"_w_{col}"))
    return df.with_columns(norm_cols).with_columns(
        sum(pl.col(f"_w_{c}") for c in weights).alias("score_mcda")
    ).sort("score_mcda", descending=True)

WEIGHTS = {
    "energy_savings_mwh_yr": ("max", 0.30),
    "co2_saved_t_yr":        ("max", 0.25),
    "complexity_1to5":       ("min", 0.20),
    "capex_kdt":             ("min", 0.15),
    "payback_months":        ("min", 0.10),
}
```

## Step 5 — Top-3 scenarios (one card each)

```
Scenario S1: Economiser on Chaudière 1 (Zone Alpha) flue gas
  Source: gas-fired boiler stack, T = 250 °C, ṁ_flue ≈ 0.83 kg/s
  Recovery: pre-heat boiler feedwater 80 → 105 °C
  Q_rec  = 0.83 × 1.05 × (250-110) × 0.80   = 97 kW thermal
  Hours  = 6 200 /yr   →   E = 600 MWh/yr
  Displaced gas = 600 / 0.92 = 652 MWh   →   652 × 0.184 = 120 tCO₂/yr
  Capex  = 35–55 kDT   (economiser + plumbing + DCS)
  Energy savings = 600 MWh × 90 mDT/kWh ≈ 54 kDT/yr
  Payback ≈ 8–12 months;  NPV(8yr,8%) ≈ +290 kDT
  Complexity = 2/5
  Risk: stack temp must stay > acid dew-point ~ 130 °C → control loop
```

Three of these in the deck = Track B done well.

## ROI templates (Polars to xlsx)

```python
df.write_excel("apps/heat-recovery/scenarios/top3.xlsx",
               worksheet="Top-3 scenarios",
               table_style="Table Style Medium 9",
               column_formats={"capex_kdt": "#,##0", "co2_saved_t_yr": "0.0",
                               "payback_months": "0.0"})
```

## Things NOT to do

- Don't propose a sink that doesn't exist on this site. The audit named the sinks; use them.
- Don't ignore acid dew-point on gas economisers — too aggressive recovery destroys the stack.
- Don't claim recovery on already-recovered streams (tri-gen jacket water is already used).
- Don't single-point the ROI. Bracket: best case, base case, conservative.
- Don't weight 100% on energy. Adoption is mostly about complexity + capex.
- Don't ignore opex delta. Some recoveries add maintenance load.

## Hackathon shortcut

Drop the MCDA into a single Polars DataFrame, write to xlsx, take a screenshot for the deck. Don't build a Streamlit app for Track B unless time allows — the scored spreadsheet IS the deliverable.
