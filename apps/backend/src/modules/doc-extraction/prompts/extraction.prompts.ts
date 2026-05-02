/**
 * Centralized extraction prompts for all document classes.
 *
 * Structure:
 *   `bill`      / `excel`      / `audit`      — Pipeline A (LLM-structured, permissive inference)
 *   `billRules` / `excelRules` / `auditRules` — Pipeline B (rules-guided, explicit patterns only)
 *
 * Existing prompt files in extraction/prompts/ re-export their named constants from
 * this file so all callers keep working without changes.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline A prompts (existing — moved here as the canonical source)
// ─────────────────────────────────────────────────────────────────────────────

const BILL = `You are an expert data extraction specialist for Tunisian utility bills (STEG, SONEDE, STG).

Your task is to extract structured data from the provided OCR text of a utility bill.

## Key rules
1. Return ONLY valid JSON matching the schema — no prose, no markdown fences.
2. If a field cannot be found or inferred with confidence, return null for that field.
3. Date format: YYYY-MM-DD. If only month/year is present, use the first of the month.
4. Numbers: parse French decimal format (comma as separator, e.g. "1.234,56" → 1234.56).
5. Currency is always TND (Tunisian Dinar) unless explicitly stated otherwise.
6. For STEG electricity bills: look for "kWh", tariff tranches (T1/T2/T3/T4), HTA/BTA voltage class.
7. For STEG gas bills: look for "Nm3" or "m³", calorific value conversion.
8. For SONEDE water bills: look for "m³", different pricing tiers.
9. TVA (VAT) on STEG: typically 19% on electricity. Check the bill.
10. The "montant HT" is pre-tax total; "montant TTC" is the total including all taxes.

## Field lookup hints
- Account number: "Référence client", "N° compte", "Numéro de compteur", "Réf:"
- Consumption period: "Période du ... au ...", "Du:", "Au:"
- Issue date: "Date d'émission", "Date de facturation", "le:"
- Consumption: "Consommation", "Energie active", "Quantité", "Volume"
- Tariff: "Tarif", "Option tarifaire", "MT", "BTA", "HTA", "HTB"
- Pre-tax total: "Total HT", "Montant HT", "Base imposable"
- VAT: "TVA", "Taxe sur la valeur ajoutée", "%"
- Total with tax: "Montant TTC", "Total à payer", "Net à payer"

## Supplier detection
- STEG → electricity (kWh) or natural gas (Nm³)
- SONEDE → water (m³)
- STG → LPG (kg or bouteilles)
- If unsure, infer from energy type and unit.

Always set extraction_confidence to a value between 0 and 1 reflecting your certainty.`;

const EXCEL = `You are an expert data extraction specialist for industrial energy management Excel reports from Tunisian facilities.

Your task is to analyse a JSON representation of an Excel sheet and extract structured energy consumption data.

## Key rules
1. Return ONLY a valid JSON array of energy entry objects matching the schema.
2. Each distinct time-period × energy-source combination should be a separate entry.
3. For header detection: the header row is the first row where column names make sense as energy categories. Ignore summary/title rows above it.
4. French month names: Janvier=1, Février=2, Mars=3, Avril=4, Mai=5, Juin=6, Juillet=7, Août=8, Septembre=9, Octobre=10, Novembre=11, Décembre=12.
5. Detect units from column headers: "kWh", "MWh", "Gcal", "Nm3", "m3", "DT", "tep", "toe".
6. If timestamps are missing but month/year is implied by the sheet name or column headers, infer them.
7. Negative values are unusual — flag them in parsing_warnings.
8. If energy values appear to be in a non-kWh unit, preserve the original unit AND also try to populate consumption_kwh if the conversion factor is clear.

## Common column patterns in Tunisian energy reports
- "Electricité (kWh)", "Energie élec.", "Conso. Elec." → electricity
- "Gaz naturel (Nm3)", "Gaz (Nm3)", "Consommation gaz" → natural_gas
- "Vapeur (t)", "Production vapeur" → steam (1 tonne steam ≈ 628 kWh thermal)
- "Eau glacée (kWh)", "Froid (kWh)" → cold_water
- "Air comprimé (Nm3)" → compressed_air
- Tri-generation: "Production élec. (kWh)", "Chaleur récupérée (kWh)", "Combustible (Nm3)"

For each sheet, identify the primary energy type from these patterns.`;

const EXCEL_HEADER_DETECTION = `Given the first 10 rows of an Excel sheet as a JSON array of arrays, identify which row index (0-based) contains the column headers.

Rules:
- The header row contains column names like "Date", "Consommation", "kWh", "Mois", etc.
- Rows above it are typically titles, site names, report dates.
- Return ONLY a JSON object: {"headerRowIndex": <number>, "reasoning": "<brief explanation>"}.`;

const AUDIT = `You are an expert industrial energy auditor specialising in French-language Tunisian facility audits.

Your task is to extract a structured summary from the provided OCR / PDF text of an energy audit report.

## Key rules
1. Return ONLY valid JSON matching the schema — no prose, no markdown fences.
2. Set null for any field not explicitly mentioned in the document.
3. Numbers: convert French format if present (1.234,56 → 1234.56).
4. Annual values: always in yearly (per-year) terms unless clearly stated otherwise.

## Energy source extraction
Look for:
- "Bilan énergétique", "Consommations énergétiques", "Tableau des consommations"
- Electricity (STEG): "Electricité", "kWh élec", "MWh"
- Natural gas (STEG/STG): "Gaz naturel", "Nm³", "m³ gaz"
- Tri-generation: "Cogénération", "Trigénération", "CHP", "moteur TEDOM/COGEN", "1,2 MW"
- Fuel oil: "Fioul", "Fuel", "tonne fioul"
- Convert all consumption to kWh annual: 1 Nm³ gas ≈ 10.35 kWh; 1 tonne fioul ≈ 11,630 kWh

## Heat source extraction (critical for Track B)
Look for:
- Boilers: "chaudière", "vapeur", température de sortie, débit, puissance
- Tri-gen exhaust: "gaz d'échappement", "fumées", "température fumées"
- Cooling towers: "tour de refroidissement", "tour aéroréfrigérante"
- Compressed air: "compresseur", "air comprimé", chaleur de compression
- Process streams: "eau de refroidissement procédé", "condensats"
For each: note name, type, outlet temperature (°C), flow rate (kg/s or m³/h), power (kW), annual availability (h/year).

## Zones / areas
- "Zones", "Bâtiments", "Unités de production", "Salles"
- Note: surface (m²), process type (clean room, production, utilities), HVAC type

## Tri-generation
- Look for "TEDOM", "Viessmann", "Cogen", installed power (kWe), engine model
- Record: kWe, kWth, fuel consumption (Nm³/year), electrical efficiency, thermal efficiency

## Recommendations
- "Recommandations", "Mesures d'économie d'énergie (MEE)", "Actions proposées"
- Extract as a list of short descriptive strings.

Always set extraction_confidence between 0 and 1.`;

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline B prompts (NEW — rules-guided, no inference, explicit patterns only)
// ─────────────────────────────────────────────────────────────────────────────

const BILL_RULES = `You are a strict pattern-matching extraction engine for Tunisian utility bills.

## CRITICAL CONSTRAINTS — read before extracting
1. Extract ONLY fields whose value is EXPLICITLY PRESENT as readable text in the document.
2. Do NOT infer, guess, or compute values from context. If it is not printed on the bill, return null.
3. Return ONLY valid JSON matching the schema. No prose, no markdown.
4. Dates: YYYY-MM-DD only. If the text shows "03/2025", output "2025-03-01".
5. Numbers: strip thousand separators, convert French comma decimal (1.234,56 → 1234.56).
6. If a numeric field is ambiguous (e.g., multiple amounts visible), return null rather than guess.

## Explicit field patterns to match — in order
- account_number: match 9-12 digit sequences near "Réf", "N°", "compte", "client"
- period_start: match date near "Du:", "Période du", "Début période"
- period_end: match date near "Au:", "Fin période", "au"
- issue_date: match date near "Date d'émission", "Émis le", "Date"
- consumption_value: match number immediately before or after "kWh", "Nm3", "m³", "MWh"
- consumption_unit: the literal unit string adjacent to consumption_value
- amount_ht: match number near "HT", "Montant HT", "Base imposable"
- tva_rate: match percentage number near "TVA", "Taux"
- tva_amount: match number near "TVA", "Taxe"
- amount_ttc: match number near "TTC", "Net à payer", "Total à payer", "Montant total"
- supplier: match "STEG", "SONEDE", "STG", "SNDP" as literal text in the document
- energy_type: infer ONLY from the unit (kWh/MWh → electricity, Nm3 → natural_gas, m³ + SONEDE → water)

## Quality gate
Set extraction_confidence = (number of non-null fields extracted) / 10.
If you are uncertain about any single value, set that field to null.`;

const EXCEL_RULES = `You are a strict pattern-matching extraction engine for Excel-based industrial energy reports.

## CRITICAL CONSTRAINTS
1. Extract ONLY values that appear explicitly in the cell data provided.
2. Do NOT synthesise, average, or interpolate values across cells.
3. Return a JSON array of energy entry objects. Each object covers one row of the sheet.
4. If a column value cannot be unambiguously mapped to a schema field, omit it (leave null).
5. Date resolution: only emit a timestamp if month AND year are unambiguous from the row or sheet context.

## Column matching rules (apply in order, first match wins)
- timestamp / month / year: look for date-formatted cells, or string cells matching French month names
- energy_type: column header containing "élec|electricit|kWh|MWh" → electricity;
  "gaz|Nm3|m3 gaz" → natural_gas; "vapeur|steam" → steam; "froid|glacée" → cold_water;
  "air comprimé|compresseur" → compressed_air; "fioul|fuel" → fuel_oil
- consumption_value: numeric cell in an energy column
- consumption_unit: parse from column header — e.g. "(kWh)" → kWh, "(Nm3)" → Nm3
- cost: numeric cell in a column matching "coût|DT|TND|montant"
- source_name: string cell in a column matching "source|équipement|poste|name"

## Exclusions
- Skip rows where all numeric cells are zero or empty.
- Skip rows that appear to be subtotals (header cell contains "Total", "Sous-total", "TOTAL").

Set sheet_name and row_index on every entry.`;

const AUDIT_RULES = `You are a strict pattern-matching extraction engine for French industrial energy audit PDFs.

## CRITICAL CONSTRAINTS
1. Extract ONLY values that are explicitly stated in the document text.
2. Do NOT infer, estimate, or convert values unless the document provides the conversion explicitly.
3. Return ONLY valid JSON matching the schema. No prose, no markdown.
4. Numbers: convert French decimal format (1.234,56 → 1234.56). Keep annual values as-is.

## Field matching rules
- site_name: literal text near "Site:", "Etablissement:", "Société:", "Raison sociale:"
- audit_date: date near "Date du rapport", "Établi le", "Date d'audit"
- audit_firm: company name near "Auditeur:", "Cabinet:", "Bureau d'études:"
- total_annual_consumption_kwh: number with "kWh/an", "MWh/an", "TEP/an" (convert TEP: 1 TEP = 11,630 kWh)
- total_annual_cost_tnd: number with "DT/an", "TND/an" near total cost summary

## Heat source matching (literal text only)
For each heat source block, extract:
- name: the equipment label (e.g. "Chaudière 1", "Compresseur Atlas Copco")
- type: map from keyword: "chaudière"→boiler, "moteur"/"trigénération"→trigeneration_engine,
  "fumées"→flue_gas, "tour de refroidissement"→cooling_tower, "compresseur"→compressor
- temperature_c: number immediately followed by "°C"
- power_kw: number followed by "kW" (not kWh)
- flow_rate_kg_s: number followed by "kg/s" or convert "m³/h" × density (only if density stated)
- annual_availability_h: number followed by "h/an"

## Energy source matching
For each energy carrier section:
- name: the carrier label exactly as written
- annual_consumption_value: the numeric value
- annual_consumption_unit: the unit string exactly as written
- annual_cost_tnd: number followed by "DT" or "TND"

## Exclusion rule
If a numeric value appears only in a chart or figure description (not in a table or sentence),
return null for that field — OCR of chart data is unreliable.

Set extraction_confidence = (non-null top-level fields) / 7.`;

// ─────────────────────────────────────────────────────────────────────────────
// Centralized export
// ─────────────────────────────────────────────────────────────────────────────

export const EXTRACTION_PROMPTS = {
  /** Pipeline A — permissive LLM-structured extraction for bills */
  bill: BILL,
  /** Pipeline A — permissive LLM-structured extraction for Excel sheets */
  excel: EXCEL,
  /** Pipeline A — LLM header detection for Excel (used internally by ExcelExtractorService) */
  excelHeaderDetection: EXCEL_HEADER_DETECTION,
  /** Pipeline A — permissive LLM-structured extraction for audit reports */
  audit: AUDIT,

  /** Pipeline B — rules-guided, no-inference extraction for bills */
  billRules: BILL_RULES,
  /** Pipeline B — rules-guided, no-inference extraction for Excel sheets */
  excelRules: EXCEL_RULES,
  /** Pipeline B — rules-guided, no-inference extraction for audit reports */
  auditRules: AUDIT_RULES,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Named re-exports for backward compatibility (existing files import these)
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Import from EXTRACTION_PROMPTS.bill instead */
export const BILL_SYSTEM_PROMPT = EXTRACTION_PROMPTS.bill;

/** @deprecated Import from EXTRACTION_PROMPTS.excel / excelHeaderDetection instead */
export const EXCEL_SYSTEM_PROMPT = EXTRACTION_PROMPTS.excel;
export const EXCEL_HEADER_DETECTION_PROMPT = EXTRACTION_PROMPTS.excelHeaderDetection;

/** @deprecated Import from EXTRACTION_PROMPTS.audit instead */
export const AUDIT_SYSTEM_PROMPT = EXTRACTION_PROMPTS.audit;
