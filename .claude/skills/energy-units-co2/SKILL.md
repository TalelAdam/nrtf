---
name: energy-units-co2
description: Use when normalizing energy units to a single canonical unit (kWh) and computing CO₂ emissions from energy data — kWh/MWh/Gcal/BTU/toe/GJ/Nm³ conversions, ADEME / IEA / IPCC emission factors, scope 1/2/3, Tunisian grid factor. Trigger on "convert to kWh", "energy unit", "Gcal to kWh", "Nm³ natural gas", "CO2 emission factor", "scope 1", "STEG grid factor", "tonnes CO2".
---

# Energy Units & CO₂

The numbers behind Part 2 §2.1 (25 pts unit normalization) and Part 2 §2.2 (15 pts CO₂ estimation), plus Track B emissions math.

## Canonical unit: kWh

Every extracted energy quantity is normalized to kWh with a recorded conversion factor and source.

## Conversion table (constants module)

```python
# apps/doc-extraction/src/validation/units.py
from decimal import Decimal as D

# Energy → kWh
TO_KWH = {
    "kWh":   D("1"),
    "MWh":   D("1000"),
    "GWh":   D("1000000"),
    "Wh":    D("0.001"),
    "GJ":    D("277.7777777778"),         # 1 GJ = 277.778 kWh
    "MJ":    D("0.2777777778"),
    "kJ":    D("0.0002777777778"),
    "Gcal":  D("1163"),                   # 1 Gcal = 1.163 MWh
    "Mcal":  D("1.163"),
    "kcal":  D("0.001163"),
    "th":    D("1.163"),                  # thermie = 1 Mcal
    "Mth":   D("1163"),                   # méga-thermies (1000 thermies)
    "BTU":   D("0.0002930711"),
    "MMBtu": D("293.0710702"),
    "toe":   D("11630"),                  # IEA: 1 toe = 11,630 kWh
    # Natural gas volumetric — depends on PCI (lower heating value)
    "Nm3_NG":     D("10.83"),             # Tunisia gas mix; replace per supplier
    "m3_NG":      D("10.83"),
    # Steam — saturated low-pressure (5 bar, h_fg ≈ 2096 kJ/kg)
    "ton_steam_LP":  D("582"),            # 1 t ≈ 582 kWh of latent heat
}

def to_kwh(value, unit: str) -> tuple[D, str]:
    if unit not in TO_KWH:
        raise ValueError(f"Unknown unit: {unit}")
    return D(value) * TO_KWH[unit], f"× {TO_KWH[unit]} kWh/{unit}"
```

Cite ADEME 2024 + audit PDF Section I-1 for the gas Nm³ factor.

## Emission factor table (Tunisia-relevant)

```python
# apps/doc-extraction/src/validation/emissions.py
from decimal import Decimal as D
EF_KGCO2_PER_KWH = {
    # Scope 2 (purchased electricity)
    "elec_TN_grid":        D("0.557"),    # STEG grid mix 2023 [STEG sustainability report]
    "elec_EU_avg":         D("0.275"),    # IEA 2024
    # Scope 1 (combustion)
    "natural_gas":         D("0.184"),    # ADEME Base Carbone 2024 (per kWh PCI)
    "diesel":              D("0.265"),
    "fuel_oil":            D("0.265"),
    "lpg":                 D("0.230"),
    # Derived (post-combustion in our boiler)
    "heat_from_NG_boiler": D("0.234"),    # natural_gas / 0.78 boiler efficiency
}
EF_KGCO2_PER_NM3 = {"natural_gas": D("2.020")}   # 0.184 × 10.83 ≈ 1.99; round to 2.02 ADEME
EF_KGCO2EQ_PER_KG = {"refrigerant_R134a": D("1430")}   # GWP100, IPCC AR6
```

Always tag the source: `EF_SOURCE = {"elec_TN_grid": "STEG 2023", "natural_gas": "ADEME 2024"}`.

## Scope tagging

```
Scope 1 — direct combustion on-site: natural gas to boilers, fuel-oil if any, diesel for gensets.
Scope 2 — purchased: STEG electricity, purchased steam (rare here).
Scope 3 — indirect (water from SONEDE treatment, transport, employee commute) — usually out of scope for this challenge.
```

## CO₂ computation per row

```python
def compute_co2(row):
    kwh, factor_str = to_kwh(row["quantity"], row["unit"])
    if row["carrier"] == "electricity":
        ef = EF_KGCO2_PER_KWH["elec_TN_grid"]; scope, src = 2, "STEG 2023"
    elif row["carrier"] == "natural_gas":
        ef = EF_KGCO2_PER_KWH["natural_gas"]; scope, src = 1, "ADEME 2024"
    else:
        raise ValueError(f"Unknown carrier: {row['carrier']}")
    return {
        "canonical_kwh": kwh,
        "co2_kg": kwh * ef,
        "scope": scope,
        "ef_used": ef,
        "ef_source": src,
        "conversion": factor_str,
    }
```

## Tri-generation allocation (the tricky one)

Gas in → electricity + recovered hot water + recovered chilled water (absorber). Three allocation methods:

| Method | Formula | When to use |
|---|---|---|
| **Energy-allocation** | EF_each = EF_gas / (Σ outputs) × output_i | Default for reporting |
| **Exergy-allocation** | weight by exergy (work-equivalent) | Most rigorous; defends in Q&A |
| **Displaced-product credit** | Charge gas only to electricity; credit hot/chilled water as if displacing boiler/chiller | Best for ROI conversations |

Pick **energy-allocation** as the default; mention exergy-allocation in the deck as "we considered it."

## Validation rules (Pandera-style)

```python
import pandera.polars as pa
import polars as pl

class EnergyRow(pa.DataFrameModel):
    ts:             pl.Datetime
    site_id:        str
    carrier:        str = pa.Field(isin=["electricity", "natural_gas", "fuel_oil", "lpg", "diesel"])
    quantity:       float = pa.Field(ge=0, lt=1e9)
    unit:           str = pa.Field(isin=list(TO_KWH))
    canonical_kwh:  float = pa.Field(ge=0)
    co2_kg:         float = pa.Field(ge=0)
    scope:          int = pa.Field(isin=[1, 2, 3])
    ef_source:      str
```

## Sanity checks (catch obvious extraction errors)

- A monthly electricity bill at 1 GWh → flag (small factory).
- Gas quantity in MWh but factor for Nm³ → catastrophic 10× error; cross-check.
- co2_kg / canonical_kwh outside [0.05, 0.7] → unknown carrier or wrong factor.
- Negative quantity → almost always an OCR error; flag.

## Things NOT to do

- Don't compute CO₂ in t before logging the per-row factor. Aggregation hides errors.
- Don't use EU-average grid factor for Tunisia.
- Don't apply heat-from-NG-boiler factor when the carrier is gas (double-counting).
- Don't switch allocation method between rows — tag the method per row.

## Hackathon shortcut

Hard-code TO_KWH and EF tables as Python dicts. Don't pull from a DB. They don't change during the hackathon.
