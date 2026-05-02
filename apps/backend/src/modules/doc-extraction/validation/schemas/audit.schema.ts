import { z } from 'zod';
import { EnergyTypeSchema } from './shared.schema';

/** Annual consumption by energy carrier */
export const AuditEnergySourceSchema = z.object({
  source_id: z.string().optional(),
  name: z.string(),
  energy_type: EnergyTypeSchema.nullable().optional(),
  supplier: z.string().nullable().optional(),
  annual_consumption_value: z.number().nullable().optional(),
  annual_consumption_unit: z.string().nullable().optional(),
  annual_consumption_kwh: z.number().nullable().optional(),    // normalized
  annual_cost_tnd: z.number().nullable().optional(),
  co2_kg: z.number().nullable().optional(),
  share_percent: z.number().min(0).max(100).nullable().optional(),
});

/** Waste-heat / cold source identified on site (feeds Track B) */
export const HeatSourceSchema = z.object({
  name: z.string(),
  type: z.enum([
    'boiler',
    'trigeneration_engine',
    'flue_gas',
    'cooling_tower',
    'compressor',
    'process_heat',
    'other',
  ]),
  temperature_c: z.number().nullable().optional(),             // °C outlet
  flow_rate_kg_s: z.number().nullable().optional(),
  power_kw: z.number().nullable().optional(),
  annual_availability_h: z.number().nullable().optional(),
  recoverable_energy_kwh_y: z.number().nullable().optional(),  // computed estimate
  zone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/** A physical zone / area of the facility */
export const AuditZoneSchema = z.object({
  name: z.string(),
  area_m2: z.number().nullable().optional(),
  primary_process: z.string().nullable().optional(),
  hvac_type: z.string().nullable().optional(),
  operating_hours_per_year: z.number().nullable().optional(),
});

/**
 * High-level summary extracted from an industrial energy audit report.
 * Designed for 15-page French pharmaceutical facility audits.
 */
export const AuditFlowSummarySchema = z.object({
  site_name: z.string().nullable().optional(),
  site_address: z.string().nullable().optional(),
  audit_date: z.string().nullable().optional(),            // ISO date
  audit_firm: z.string().nullable().optional(),
  report_reference: z.string().nullable().optional(),

  // Energy overview
  energy_sources: z.array(AuditEnergySourceSchema).optional(),
  total_annual_consumption_kwh: z.number().nullable().optional(),
  total_annual_cost_tnd: z.number().nullable().optional(),
  total_co2_kg: z.number().nullable().optional(),
  energy_intensity_kwh_m2: z.number().nullable().optional(),

  // Tri-generation summary (if present)
  trigeneration: z
    .object({
      installed_kw: z.number().nullable().optional(),
      engine_model: z.string().nullable().optional(),
      annual_production_kwh: z.number().nullable().optional(),
      fuel_consumption_nm3: z.number().nullable().optional(),
      electrical_efficiency: z.number().min(0).max(1).nullable().optional(),
      thermal_efficiency: z.number().min(0).max(1).nullable().optional(),
    })
    .nullable()
    .optional(),

  // Physical layout
  zones: z.array(AuditZoneSchema).optional(),
  total_area_m2: z.number().nullable().optional(),

  // Waste-heat inventory (critical for Track B)
  heat_sources: z.array(HeatSourceSchema).optional(),

  // Recommendations / measures identified
  recommendations: z.array(z.string()).optional(),

  extraction_confidence: z.number().min(0).max(1).optional(),
  page_count: z.number().int().nonnegative().optional(),
});

export type AuditFlowSummary = z.infer<typeof AuditFlowSummarySchema>;
export type HeatSource = z.infer<typeof HeatSourceSchema>;
export type AuditEnergySource = z.infer<typeof AuditEnergySourceSchema>;
