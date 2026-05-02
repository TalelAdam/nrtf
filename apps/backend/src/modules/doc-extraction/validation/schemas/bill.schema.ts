import { z } from 'zod';
import { EnergyUnitSchema, FieldSourceSchema } from './shared.schema';

/** Tunisian utility providers */
export const SupplierSchema = z.enum([
  'STEG',   // Société Tunisienne de l'Electricité et du Gaz
  'SONEDE', // Société Nationale d'Exploitation et de Distribution des Eaux
  'STG',    // Société Tunisienne du Gaz (LP gas)
  'SNDP',   // Société Nationale de Distribution des Pétroles
  'other',
]);

/** Single line item inside a bill (tariff tranche, penalty, service fee, …) */
export const BillLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().nullable().optional(),
  unit: EnergyUnitSchema.nullable().optional(),
  unit_price_ht: z.number().nullable().optional(),
  amount_ht: z.number(),
  source: FieldSourceSchema.optional(),
});

/**
 * Structured extraction of a Tunisian utility energy bill.
 * Covers STEG electricity, STEG gas, SONEDE water, STG LPG.
 */
export const EnergyBillSchema = z.object({
  supplier: SupplierSchema.nullable().optional(),
  account_number: z.string().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  customer_address: z.string().nullable().optional(),
  meter_number: z.string().nullable().optional(),

  // Billing period
  period_start: z.string().nullable().optional(),   // ISO date YYYY-MM-DD
  period_end: z.string().nullable().optional(),
  issue_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),

  // Consumption
  consumption_value: z.number().nullable().optional(),
  consumption_unit: EnergyUnitSchema.nullable().optional(),
  consumption_kwh: z.number().nullable().optional(), // always normalized to kWh

  // Amounts
  amount_ht: z.number().nullable().optional(),       // pre-tax total
  tva_rate: z.number().min(0).max(1).nullable().optional(),  // e.g. 0.19
  tva_amount: z.number().nullable().optional(),
  amount_ttc: z.number().nullable().optional(),      // total incl. tax
  currency: z.string().default('TND'),

  // Tariff / classification
  tariff_type: z.string().nullable().optional(),     // HTA, BP2, MT, BT, …
  voltage_class: z.string().nullable().optional(),   // HTB, HTA, MT, BTA
  energy_type: z
    .enum(['electricity', 'natural_gas', 'water', 'lpg', 'other'])
    .nullable()
    .optional(),

  line_items: z.array(BillLineItemSchema).optional(),
  notes: z.string().nullable().optional(),

  // Extraction meta
  extraction_confidence: z.number().min(0).max(1).optional(),
  ocr_raw_text: z.string().optional(),
});

export type EnergyBill = z.infer<typeof EnergyBillSchema>;
export type BillLineItem = z.infer<typeof BillLineItemSchema>;
