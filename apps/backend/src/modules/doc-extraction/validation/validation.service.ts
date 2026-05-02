import { Injectable, Logger } from '@nestjs/common';
import { EnergyBillSchema, type EnergyBill } from '../validation/schemas/bill.schema';
import { ExcelExtractionResultSchema } from '../validation/schemas/excel-entry.schema';
import type { ExcelExtractionResult } from '../validation/schemas/excel-entry.schema';
import { AuditFlowSummarySchema, type AuditFlowSummary } from '../validation/schemas/audit.schema';
import { ZodError } from 'zod';

export interface ValidationReport {
  valid: boolean;
  fieldCount: number;
  nullFields: string[];
  errors: string[];
  /** Cross-field consistency checks (e.g. HT + TVA ≈ TTC) */
  consistencyWarnings: string[];
  /** 0-1 quality score based on fill rate and consistency */
  qualityScore: number;
}

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  validateBill(bill: unknown): ValidationReport {
    const errors: string[] = [];
    const consistencyWarnings: string[] = [];

    // Schema validation
    try {
      EnergyBillSchema.parse(bill);
    } catch (err) {
      if (err instanceof ZodError) {
        errors.push(...err.errors.map((e) => `${e.path.join('.')}: ${e.message}`));
      }
    }

    const typed = bill as Partial<EnergyBill>;

    // Field fill analysis
    const keyFields = [
      'supplier', 'account_number', 'period_start', 'period_end',
      'consumption_value', 'consumption_unit', 'amount_ht', 'amount_ttc',
      'energy_type', 'issue_date',
    ];
    const nullFields = keyFields.filter(
      (f) => typed[f as keyof EnergyBill] === null || typed[f as keyof EnergyBill] === undefined,
    );

    // Cross-field consistency checks
    if (typed.amount_ht !== null && typed.amount_ht !== undefined &&
        typed.tva_amount !== null && typed.tva_amount !== undefined &&
        typed.amount_ttc !== null && typed.amount_ttc !== undefined) {
      const computed = (typed.amount_ht) + (typed.tva_amount);
      const actual = typed.amount_ttc;
      const delta = Math.abs(computed - actual);
      if (delta > actual * 0.05) {
        consistencyWarnings.push(
          `amount_ht (${typed.amount_ht}) + tva_amount (${typed.tva_amount}) ≠ amount_ttc (${typed.amount_ttc}) — delta=${delta.toFixed(2)}`,
        );
      }
    }

    if (typed.period_start && typed.period_end) {
      const start = new Date(typed.period_start);
      const end = new Date(typed.period_end);
      if (end <= start) {
        consistencyWarnings.push(`period_end (${typed.period_end}) ≤ period_start (${typed.period_start})`);
      }
    }

    const fillRate = (keyFields.length - nullFields.length) / keyFields.length;
    const consistencyPenalty = consistencyWarnings.length * 0.1;
    const qualityScore = Math.max(0, fillRate - consistencyPenalty);

    return {
      valid: errors.length === 0,
      fieldCount: keyFields.length - nullFields.length,
      nullFields,
      errors,
      consistencyWarnings,
      qualityScore,
    };
  }

  validateExcel(result: unknown): ValidationReport {
    const errors: string[] = [];
    try {
      ExcelExtractionResultSchema.parse(result);
    } catch (err) {
      if (err instanceof ZodError) {
        errors.push(...err.errors.map((e) => `${e.path.join('.')}: ${e.message}`));
      }
    }

    const typed = result as Partial<ExcelExtractionResult>;
    const entries = typed.entries ?? [];
    const nullFields: string[] = entries.length === 0 ? ['entries'] : [];

    const fillRates = entries.map((e) => {
      const required = ['timestamp', 'energy_type', 'consumption_value', 'consumption_unit'];
      const filled = required.filter((f) => e[f as keyof typeof e] !== null && e[f as keyof typeof e] !== undefined);
      return filled.length / required.length;
    });
    const avgFill = fillRates.length > 0 ? fillRates.reduce((a, b) => a + b, 0) / fillRates.length : 0;

    return {
      valid: errors.length === 0,
      fieldCount: entries.length,
      nullFields,
      errors,
      consistencyWarnings: [],
      qualityScore: avgFill,
    };
  }

  validateAudit(summary: unknown): ValidationReport {
    const errors: string[] = [];
    try {
      AuditFlowSummarySchema.parse(summary);
    } catch (err) {
      if (err instanceof ZodError) {
        errors.push(...err.errors.map((e) => `${e.path.join('.')}: ${e.message}`));
      }
    }

    const typed = summary as Partial<AuditFlowSummary>;
    const keyFields = [
      'site_name', 'audit_date', 'energy_sources', 'total_annual_consumption_kwh',
      'heat_sources', 'zones', 'total_co2_kg',
    ];
    const nullFields = keyFields.filter(
      (f) => {
        const val = typed[f as keyof AuditFlowSummary];
        return val === null || val === undefined || (Array.isArray(val) && val.length === 0);
      },
    );

    const fillRate = (keyFields.length - nullFields.length) / keyFields.length;
    return {
      valid: errors.length === 0,
      fieldCount: keyFields.length - nullFields.length,
      nullFields,
      errors,
      consistencyWarnings: [],
      qualityScore: fillRate,
    };
  }
}
