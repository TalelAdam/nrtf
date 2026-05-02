import { z } from 'zod';

/** Energy measurement units — canonical set for the competition */
export const EnergyUnitSchema = z.enum([
  'kWh',
  'MWh',
  'Gcal',
  'BTU',
  'toe',
  'tep',
  'GJ',
  'Nm3',   // natural gas volumetric
  'MNm3',  // 10^6 Nm³
  'TND',   // Tunisian Dinar (currency line-item)
  'other',
]);
export type EnergyUnit = z.infer<typeof EnergyUnitSchema>;

/** Energy carrier types */
export const EnergyTypeSchema = z.enum([
  'electricity',
  'natural_gas',
  'steam',
  'hot_water',
  'cold_water',
  'compressed_air',
  'fuel_oil',
  'diesel',
  'lpg',
  'other',
]);
export type EnergyType = z.infer<typeof EnergyTypeSchema>;

/** Provenance of an extracted value — every field that comes from OCR carries this */
export const FieldSourceSchema = z.object({
  page: z.number().int().nonnegative().nullable().optional(),
  bbox: z
    .tuple([z.number(), z.number(), z.number(), z.number()])
    .nullable()
    .optional(),
  ocr_engine: z.string().default('unknown'),
  confidence: z.number().min(0).max(1).default(0),
});
export type FieldSource = z.infer<typeof FieldSourceSchema>;
