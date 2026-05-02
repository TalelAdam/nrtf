import { z } from 'zod';
import { EnergyUnitSchema, EnergyTypeSchema } from './shared.schema';

/**
 * A single energy-consumption data point extracted from an Excel report row.
 * Designed for multi-sheet tri-generation / utility reports.
 */
export const EnergyEntrySchema = z.object({
  // Time dimension
  timestamp: z.string().nullable().optional(),           // ISO 8601
  period_label: z.string().nullable().optional(),        // e.g., "Juillet 2025"
  month: z.number().int().min(1).max(12).nullable().optional(),
  year: z.number().int().min(2000).max(2100).nullable().optional(),

  // Source identification
  source_name: z.string().nullable().optional(),         // "Chaudière 1", "Groupe Froid", …
  source_id: z.string().nullable().optional(),
  energy_type: EnergyTypeSchema.nullable().optional(),

  // Consumption
  consumption_value: z.number().nullable().optional(),
  consumption_unit: EnergyUnitSchema.nullable().optional(),
  consumption_kwh: z.number().nullable().optional(),     // normalized

  // Production (for generators / CHP)
  production_value: z.number().nullable().optional(),
  production_unit: EnergyUnitSchema.nullable().optional(),

  // Cost
  cost: z.number().nullable().optional(),
  cost_currency: z.string().nullable().optional(),

  // Efficiency / derived
  efficiency: z.number().min(0).max(1).nullable().optional(),
  cop: z.number().nullable().optional(),                 // COP for chillers

  // Extraction provenance
  sheet_name: z.string().optional(),
  row_index: z.number().int().nonnegative().optional(),
  column_name: z.string().optional(),
});

export type EnergyEntry = z.infer<typeof EnergyEntrySchema>;

/** Top-level wrapper returned when extracting a whole Excel workbook */
export const ExcelExtractionResultSchema = z.object({
  file_name: z.string(),
  sheet_count: z.number().int().nonnegative(),
  entries: z.array(EnergyEntrySchema),
  header_rows: z.record(z.string(), z.number()).optional(),  // sheetName → row index
  parsing_warnings: z.array(z.string()).optional(),
  extraction_confidence: z.number().min(0).max(1).optional(),
});

export type ExcelExtractionResult = z.infer<typeof ExcelExtractionResultSchema>;
