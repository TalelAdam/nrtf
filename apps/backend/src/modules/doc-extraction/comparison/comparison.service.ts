/**
 * ComparisonService — orchestrates parallel Pipeline A + Pipeline B execution
 * and produces a ComparisonResultDto.
 *
 * Pipeline A: existing LLM-structured extractors (Bill/Excel/Audit + Zod validation)
 * Pipeline B: PipelineBService (regex-first + constrained LLM fallback)
 *
 * Both pipelines run concurrently via Promise.all. The validation pass (Zod +
 * cross-field consistency) is applied to each output independently, and the
 * AccuracyService produces the field-level comparison report.
 */

import {
  Injectable,
  Logger,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { FileTypeService } from '../ingest/file-type.service';
import { BillExtractorService } from '../extraction/bill-extractor.service';
import { ExcelExtractorService } from '../extraction/excel-extractor.service';
import { AuditExtractorService } from '../extraction/audit-extractor.service';
import { ValidationService } from '../validation/validation.service';
import { PipelineBService } from './pipeline-b.service';
import { AccuracyService } from './accuracy.service';
import type { ComparisonResultDto, PipelineResultDto } from './dto/comparison-result.dto';
import type { ValidationReport } from '../validation/validation.service';
import type { EnergyBill } from '../validation/schemas/bill.schema';
import type { ExcelExtractionResult } from '../validation/schemas/excel-entry.schema';
import type { AuditFlowSummary } from '../validation/schemas/audit.schema';

// ─── Key bill fields expected in the extracted record (for fill-rate calc) ───
const BILL_KEY_FIELDS = [
  'supplier', 'account_number', 'period_start', 'period_end', 'issue_date',
  'consumption_value', 'consumption_unit', 'amount_ht', 'tva_rate', 'tva_amount', 'amount_ttc',
];

const AUDIT_KEY_FIELDS = [
  'site_name', 'audit_date', 'audit_firm', 'energy_sources',
  'total_annual_consumption_kwh', 'heat_sources', 'total_co2_kg',
];

@Injectable()
export class ComparisonService {
  private readonly logger = new Logger(ComparisonService.name);

  constructor(
    private readonly fileType: FileTypeService,
    private readonly billExtractor: BillExtractorService,
    private readonly excelExtractor: ExcelExtractorService,
    private readonly auditExtractor: AuditExtractorService,
    private readonly pipelineB: PipelineBService,
    private readonly accuracy: AccuracyService,
    private readonly validation: ValidationService,
  ) {}

  async compare(buffer: Buffer, filename: string): Promise<ComparisonResultDto> {
    const probe = this.fileType.probe(buffer, filename);
    this.logger.log(
      `Comparison: ${filename} → kind=${probe.kind}, size=${probe.sizeBytes}B`,
    );

    if (probe.kind === 'unknown') {
      throw new UnsupportedMediaTypeException(
        `Unsupported file type: ${filename}. Supported: PDF, JPEG, PNG, XLSX.`,
      );
    }

    let pipelineA: PipelineResultDto;
    let pipelineB: PipelineResultDto;
    let validationA: ValidationReport;
    let validationB: ValidationReport;

    // ── Excel ──────────────────────────────────────────────────────────────
    if (probe.kind === 'excel') {
      [{ pipelineA, validationA }, { pipelineB, validationB }] = await Promise.all([
        this.runExcelPipelineA(buffer, filename),
        this.runExcelPipelineB(buffer, filename),
      ]);
    }
    // ── Audit (large native PDF) ───────────────────────────────────────────
    else if (probe.kind === 'native_pdf' && probe.sizeBytes > 100_000) {
      [{ pipelineA, validationA }, { pipelineB, validationB }] = await Promise.all([
        this.runAuditPipelineA(buffer),
        this.runAuditPipelineB(buffer),
      ]);
    }
    // ── Bill (default: PDF + image) ────────────────────────────────────────
    else {
      [{ pipelineA, validationA }, { pipelineB, validationB }] = await Promise.all([
        this.runBillPipelineA(buffer, probe.kind),
        this.runBillPipelineB(buffer, probe.kind),
      ]);
    }

    const accuracyReport = this.accuracy.compare(
      pipelineA,
      pipelineB,
      validationA,
      validationB,
    );

    return {
      document: {
        name: filename,
        mimeType: probe.mimeType,
        sizeBytes: probe.sizeBytes,
      },
      pipelineA,
      pipelineB,
      accuracy: accuracyReport,
    };
  }

  // ─── Bill pipeline runners ────────────────────────────────────────────────

  private async runBillPipelineA(
    buffer: Buffer,
    kind: string,
  ): Promise<{ pipelineA: PipelineResultDto; validationA: ValidationReport }> {
    try {
      const { bill, ocrConfidence, processingTimeMs } = await this.billExtractor.extract(
        buffer,
        kind as Parameters<BillExtractorService['extract']>[1],
      );
      const validationA = this.validation.validateBill(bill);
      const pipelineA = this.billToDto(bill, validationA, processingTimeMs, ocrConfidence);
      return { pipelineA, validationA };
    } catch (err) {
      this.logger.error(`Pipeline A bill failed: ${(err as Error).message}`);
      return this.failedPipeline('LLM-Structured', BILL_KEY_FIELDS.length);
    }
  }

  private async runBillPipelineB(
    buffer: Buffer,
    kind: string,
  ): Promise<{ pipelineB: PipelineResultDto; validationB: ValidationReport }> {
    try {
      const dto = await this.pipelineB.extractBill(
        buffer,
        kind as Parameters<PipelineBService['extractBill']>[1],
      );
      const validationB = this.validation.validateBill(dto.extracted);
      dto.qualityScore = validationB.qualityScore;
      return { pipelineB: dto, validationB };
    } catch (err) {
      this.logger.error(`Pipeline B bill failed: ${(err as Error).message}`);
      return this.failedPipeline('OCR-Rules', BILL_KEY_FIELDS.length);
    }
  }

  // ─── Excel pipeline runners ───────────────────────────────────────────────

  private async runExcelPipelineA(
    buffer: Buffer,
    filename: string,
  ): Promise<{ pipelineA: PipelineResultDto; validationA: ValidationReport }> {
    try {
      const { result, processingTimeMs } = await this.excelExtractor.extract(buffer, filename);
      const validationA = this.validation.validateExcel(result);
      const pipelineA = this.excelToDto(result, validationA, processingTimeMs);
      return { pipelineA, validationA };
    } catch (err) {
      this.logger.error(`Pipeline A excel failed: ${(err as Error).message}`);
      return this.failedPipeline('LLM-Structured', 6);
    }
  }

  private async runExcelPipelineB(
    buffer: Buffer,
    filename: string,
  ): Promise<{ pipelineB: PipelineResultDto; validationB: ValidationReport }> {
    try {
      const dto = await this.pipelineB.extractExcel(buffer, filename);
      const validationB = this.validation.validateExcel(dto.extracted);
      dto.qualityScore = validationB.qualityScore;
      return { pipelineB: dto, validationB };
    } catch (err) {
      this.logger.error(`Pipeline B excel failed: ${(err as Error).message}`);
      return this.failedPipeline('OCR-Rules', 6);
    }
  }

  // ─── Audit pipeline runners ───────────────────────────────────────────────

  private async runAuditPipelineA(
    buffer: Buffer,
  ): Promise<{ pipelineA: PipelineResultDto; validationA: ValidationReport }> {
    try {
      const { summary, processingTimeMs } = await this.auditExtractor.extract(buffer);
      const validationA = this.validation.validateAudit(summary);
      const pipelineA = this.auditToDto(summary, validationA, processingTimeMs);
      return { pipelineA, validationA };
    } catch (err) {
      this.logger.error(`Pipeline A audit failed: ${(err as Error).message}`);
      return this.failedPipeline('LLM-Structured', AUDIT_KEY_FIELDS.length);
    }
  }

  private async runAuditPipelineB(
    buffer: Buffer,
  ): Promise<{ pipelineB: PipelineResultDto; validationB: ValidationReport }> {
    try {
      const dto = await this.pipelineB.extractAudit(buffer);
      const validationB = this.validation.validateAudit(dto.extracted);
      dto.qualityScore = validationB.qualityScore;
      return { pipelineB: dto, validationB };
    } catch (err) {
      this.logger.error(`Pipeline B audit failed: ${(err as Error).message}`);
      return this.failedPipeline('OCR-Rules', AUDIT_KEY_FIELDS.length);
    }
  }

  // ─── DTO builders ─────────────────────────────────────────────────────────

  private billToDto(
    bill: EnergyBill,
    validation: ValidationReport,
    processingMs: number,
    ocrConfidence?: number,
  ): PipelineResultDto {
    const extracted = bill as Record<string, unknown>;
    const fieldsExtracted = BILL_KEY_FIELDS.filter(
      (f) => extracted[f] !== null && extracted[f] !== undefined,
    ).length;

    // Build flat confidence map from OCR confidence (same for all OCR-sourced fields)
    const fieldConf = ocrConfidence !== undefined ? ocrConfidence / 100 : 0.8;
    const confidence: Record<string, number> = Object.fromEntries(
      BILL_KEY_FIELDS.map((f) => [f, extracted[f] !== null && extracted[f] !== undefined ? fieldConf : 0]),
    );
    // Override extraction_confidence from the bill itself if present
    if (typeof bill.extraction_confidence === 'number') {
      for (const f of BILL_KEY_FIELDS) {
        if (extracted[f] !== null && extracted[f] !== undefined) {
          confidence[f] = bill.extraction_confidence;
        }
      }
    }

    return {
      name: 'LLM-Structured',
      extracted,
      fieldsExtracted,
      fieldsTotal: BILL_KEY_FIELDS.length,
      extractionRate: fieldsExtracted / BILL_KEY_FIELDS.length,
      qualityScore: validation.qualityScore,
      processingMs,
      confidence,
    };
  }

  private excelToDto(
    result: ExcelExtractionResult,
    validation: ValidationReport,
    processingMs: number,
  ): PipelineResultDto {
    const extracted = result as Record<string, unknown>;
    const entries = result.entries ?? [];
    const fieldsExtracted = entries.length > 0 ? 5 : 0; // entries + metadata = ~5 meaningful fields
    const confidence: Record<string, number> = {
      file_name: 1.0,
      sheet_count: 1.0,
      entries: result.extraction_confidence ?? 0.8,
      header_rows: 0.9,
      parsing_warnings: 1.0,
    };

    return {
      name: 'LLM-Structured',
      extracted,
      fieldsExtracted,
      fieldsTotal: 6,
      extractionRate: fieldsExtracted / 6,
      qualityScore: validation.qualityScore,
      processingMs,
      confidence,
    };
  }

  private auditToDto(
    summary: AuditFlowSummary,
    validation: ValidationReport,
    processingMs: number,
  ): PipelineResultDto {
    const extracted = summary as Record<string, unknown>;
    const fieldsExtracted = AUDIT_KEY_FIELDS.filter((f) => {
      const v = extracted[f];
      return v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0);
    }).length;

    const baseConf = summary.extraction_confidence ?? 0.75;
    const confidence: Record<string, number> = Object.fromEntries(
      AUDIT_KEY_FIELDS.map((f) => {
        const v = extracted[f];
        const present = v !== null && v !== undefined && !(Array.isArray(v) && (v as unknown[]).length === 0);
        return [f, present ? baseConf : 0];
      }),
    );

    return {
      name: 'LLM-Structured',
      extracted,
      fieldsExtracted,
      fieldsTotal: AUDIT_KEY_FIELDS.length,
      extractionRate: fieldsExtracted / AUDIT_KEY_FIELDS.length,
      qualityScore: validation.qualityScore,
      processingMs,
      confidence,
    };
  }

  // ─── Error fallback ───────────────────────────────────────────────────────

  private failedPipeline(
    name: PipelineResultDto['name'],
    fieldsTotal: number,
  ): { pipelineA: PipelineResultDto; validationA: ValidationReport } &
    { pipelineB: PipelineResultDto; validationB: ValidationReport } {
    const emptyDto: PipelineResultDto = {
      name,
      extracted: {},
      fieldsExtracted: 0,
      fieldsTotal,
      extractionRate: 0,
      qualityScore: 0,
      processingMs: 0,
      confidence: {},
    };
    const emptyValidation: ValidationReport = {
      valid: false,
      fieldCount: 0,
      nullFields: [],
      errors: ['Pipeline failed'],
      consistencyWarnings: [],
      qualityScore: 0,
    };
    return {
      pipelineA: emptyDto,
      validationA: emptyValidation,
      pipelineB: emptyDto,
      validationB: emptyValidation,
    };
  }
}

// Re-export so module barrel has a single import point
export type { ExcelExtractionResult };
