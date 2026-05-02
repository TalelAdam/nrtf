/**
 * Energy unit normalisation to kWh
 * Conversion factors sourced from:
 *   - IEA (toe → 11 630 kWh)
 *   - ADEME Base Carbone 2024 (gas PCI, emission factors)
 *   - Audit PDF §I-1 (Tunisia gas mix 10.83 kWh/Nm³)
 *   - STEG Sustainability Report 2023 (grid EF 0.557 kgCO₂/kWh)
 */

// ─── Conversion: any unit → kWh ───────────────────────────────────────────────
export const TO_KWH: Record<string, number> = {
  kWh:         1,
  MWh:         1_000,
  GWh:         1_000_000,
  Wh:          0.001,
  GJ:          277.7778,       // 1 GJ = 277.778 kWh  (IEA)
  MJ:          0.27778,
  kJ:          0.00027778,
  Gcal:        1163,           // 1 Gcal = 1.163 MWh   (ADEME)
  Mcal:        1.163,
  kcal:        0.001163,
  th:          1.163,          // thermie = 1 Mcal
  Mth:         1163,           // méga-thermies
  BTU:         0.00029307,
  MMBtu:       293.071,
  toe:         11_630,         // IEA: 1 toe = 11 630 kWh
  tep:         11_630,         // French: tonne équivalent pétrole
  Nm3_NG:      10.83,          // Tunisia gas mix (ADEME / audit §I-1)
  'm3_NG':     10.83,
  Nm3:         10.83,
  'm3':        10.83,          // assume natural gas context
  'ton_steam': 582,            // 1 t saturated steam LP ≈ 582 kWh latent
};

// Human-readable labels for formula display
export const UNIT_LABELS: Record<string, string> = {
  kWh: 'kWh', MWh: 'MWh', GWh: 'GWh', Wh: 'Wh',
  GJ: 'GJ', MJ: 'MJ', kJ: 'kJ',
  Gcal: 'Gcal', Mcal: 'Mcal', kcal: 'kcal',
  th: 'th', Mth: 'Mth',
  BTU: 'BTU', MMBtu: 'MMBtu',
  toe: 'toe', tep: 'tep',
  Nm3_NG: 'Nm³ (gaz)', 'm3_NG': 'm³ (gaz)', Nm3: 'Nm³', 'm3': 'm³',
  'ton_steam': 't vapeur',
};

// ─── CO₂ emission factors (kgCO₂/kWh) ───────────────────────────────────────
export interface EmissionFactor {
  ef: number;
  label: string;
  scope: 1 | 2;
}

export const EF_KG_CO2_PER_KWH: Record<string, EmissionFactor> = {
  electricity: { ef: 0.557, label: 'STEG 2023',  scope: 2 },
  natural_gas: { ef: 0.184, label: 'ADEME 2024', scope: 1 },
  diesel:      { ef: 0.265, label: 'ADEME 2024', scope: 1 },
  fuel_oil:    { ef: 0.265, label: 'ADEME 2024', scope: 1 },
  steam:       { ef: 0.234, label: 'chaudière NG 78%', scope: 1 },
  default:     { ef: 0.557, label: 'STEG 2023',  scope: 2 },
};

// ─── Carrier inference from field name ───────────────────────────────────────
function inferCarrier(field: string): string {
  const f = field.toLowerCase();
  if (f.includes('gaz') || f.includes('gas') || f.includes('nm3') || f.includes('m3') || f.includes('gpl') || f.includes('methane')) return 'natural_gas';
  if (f.includes('diesel') || f.includes('gasoil') || f.includes('fuel')) return 'diesel';
  if (f.includes('steam') || f.includes('vapeur')) return 'steam';
  return 'electricity';
}

// ─── Normalised output row ────────────────────────────────────────────────────
export interface NormRow {
  field: string;
  originalValue: number;
  originalUnit: string;
  factor: number;
  kWh: number;
  formulaStr: string;     // e.g. "2.5 × 1 163 kWh/Gcal"
  carrier: string;
  co2Kg: number;
  efLabel: string;
  scope: 1 | 2;
}

/**
 * Takes any ExtractionRecord array and returns rows where unit is a known
 * energy unit. Skips null / non-numeric values.
 */
export function normalizeToKwh(
  records: { field: string; value: string | number | null; unit?: string }[],
): NormRow[] {
  const rows: NormRow[] = [];
  for (const r of records) {
    if (!r.unit) continue;
    const factor = TO_KWH[r.unit];
    if (factor === undefined) continue;
    if (r.value === null || r.value === undefined) continue;
    const numVal = typeof r.value === 'number' ? r.value : parseFloat(String(r.value));
    if (isNaN(numVal)) continue;

    const kWh = numVal * factor;
    const carrier = inferCarrier(r.field);
    const efInfo = EF_KG_CO2_PER_KWH[carrier] ?? EF_KG_CO2_PER_KWH.default;
    const co2Kg = kWh * efInfo.ef;

    rows.push({
      field: r.field,
      originalValue: numVal,
      originalUnit: r.unit,
      factor,
      kWh,
      formulaStr: `${fmtNum(numVal)} × ${factor.toLocaleString()} kWh/${UNIT_LABELS[r.unit] ?? r.unit}`,
      carrier,
      co2Kg,
      efLabel: efInfo.label,
      scope: efInfo.scope,
    });
  }
  return rows;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtNum(v: number): string {
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function fmtKwh(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} GWh`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(2)} MWh`;
  return `${v.toFixed(1)} kWh`;
}
