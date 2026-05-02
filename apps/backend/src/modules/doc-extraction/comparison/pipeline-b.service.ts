/**
 * Pipeline B — Regex/pattern-first extraction with constrained-LLM fallback.
 *
 * Strategy per document class:
 *   Bill   → apply named regex patterns → fields with confidence < 0.6 fall back to Claude
 *            with the `billRules` system prompt (structured output, no inference allowed).
 *   Excel  → parse numeric cells directly from SheetJS → LLM fallback for unmapped columns.
 *   Audit  → heading + number patterns → LLM fallback for complex fields.
 *
 * Cost control: if a field's regex confidence >= 0.6, the LLM is NOT called for that field.
 * The LLM is only called once (at most) per document with a reduced prompt covering only
 * the low-confidence fields.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import pdfParse from 'pdf-parse';
import { createHash } from 'crypto';

import { OcrService } from '../ocr/ocr.service';
import { ExtractionCacheService } from '../cache/extraction-cache.service';
import { EXTRACTION_PROMPTS } from '../prompts/extraction.prompts';
import { EnergyBillSchema } from '../validation/schemas/bill.schema';
import { EnergyEntrySchema, ExcelExtractionResultSchema } from '../validation/schemas/excel-entry.schema';
import { AuditFlowSummarySchema } from '../validation/schemas/audit.schema';
import type { DocumentKind } from '../ingest/file-type.service';
import type { PipelineResultDto } from './dto/comparison-result.dto';

// ─── Regex patterns for bill fields ──────────────────────────────────────────

/**
 * Each pattern returns a match array or null.
 * Confidence is computed from match quality (presence of named groups, etc.).
 */
interface RegexPattern {
  field: string;
  /** Applied to the full OCR text */
  pattern: RegExp;
  /** Extract the raw string value from the RegExp match */
  extract: (match: RegExpMatchArray) => string;
  /** Override confidence when the pattern matches (default 0.85) */
  matchConfidence?: number;
}

const BILL_PATTERNS: RegexPattern[] = [
  {
    field: 'account_number',
    pattern: /(?:R[eé]f(?:erence)?\.?\s*(?:client)?|N[°o]?\s*(?:compte|client)|Num[eé]ro)[:\s]*(\d{7,14})/i,
    extract: (m) => m[1]!,
    matchConfidence: 0.9,
  },
  {
    field: 'period_start',
    // "Du 01/01/2025" or "Période du 01/01/2025"
    pattern: /(?:du|p[eé]riode\s+du|d[eé]but\s+p[eé]riode)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    extract: (m) => normaliseDateFr(m[1]!),
    matchConfidence: 0.85,
  },
  {
    field: 'period_end',
    // "au 31/01/2025" or "Fin période 31/01/2025"
    pattern: /(?:au|fin\s+p[eé]riode)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    extract: (m) => normaliseDateFr(m[1]!),
    matchConfidence: 0.85,
  },
  {
    field: 'issue_date',
    pattern: /(?:date\s+d'[eé]mission|[eé]mis\s+le|date\s+de\s+facturation|date)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    extract: (m) => normaliseDateFr(m[1]!),
    matchConfidence: 0.8,
  },
  {
    field: 'consumption_value',
    // "1 234,56 kWh" or "1234.56 MWh" or "123,4 Nm3"
    pattern: /([\d\s]+[,.]?\d*)\s*(kWh|MWh|Nm3|m[³3]|Gcal)/i,
    extract: (m) => parseFrenchNumber(m[1]!),
    matchConfidence: 0.88,
  },
  {
    field: 'consumption_unit',
    pattern: /[\d\s]+[,.]?\d*\s*(kWh|MWh|Nm3|m[³3]|Gcal)/i,
    extract: (m) => normaliseUnit(m[1]!),
    matchConfidence: 0.9,
  },
  {
    field: 'amount_ht',
    pattern: /(?:total\s+HT|montant\s+HT|base\s+imposable)[:\s]*([\d\s]+[,.]\d{2})\s*(?:TND|DT)?/i,
    extract: (m) => parseFrenchNumber(m[1]!),
    matchConfidence: 0.87,
  },
  {
    field: 'tva_rate',
    // "TVA 19%" or "Taux TVA : 19,00 %"
    pattern: /(?:taux\s+)?TVA[:\s]*([\d,]+)\s*%/i,
    extract: (m) => String(parseFloat(parseFrenchNumber(m[1]!)) / 100),
    matchConfidence: 0.9,
  },
  {
    field: 'tva_amount',
    // "TVA (19%) : 12,34 TND"  — take the second number that follows the percentage
    pattern: /TVA[^:]*:[^0-9]*([\d\s]+[,.]\d{2})\s*(?:TND|DT)/i,
    extract: (m) => parseFrenchNumber(m[1]!),
    matchConfidence: 0.82,
  },
  {
    field: 'amount_ttc',
    pattern: /(?:net\s+[àa]\s+payer|montant\s+TTC|total\s+[àa]\s+payer|total\s+TTC)[:\s]*([\d\s]+[,.]\d{2})\s*(?:TND|DT)?/i,
    extract: (m) => parseFrenchNumber(m[1]!),
    matchConfidence: 0.9,
  },
  {
    field: 'supplier',
    pattern: /\b(STEG|SONEDE|STG|SNDP)\b/i,
    extract: (m) => m[1]!.toUpperCase(),
    matchConfidence: 0.95,
  },
];

// ─── Audit heading + number patterns ─────────────────────────────────────────

const AUDIT_PATTERNS: RegexPattern[] = [
  {
    field: 'site_name',
    pattern: /(?:site|[eé]tablissement|soci[eé]t[eé]|raison\s+sociale)[:\s]+([A-Za-z0-9\s\-&,.()]{3,60})/i,
    extract: (m) => m[1]!.trim(),
    matchConfidence: 0.75,
  },
  {
    field: 'audit_date',
    pattern: /(?:date\s+(?:du\s+)?rapport|[eé]tabli\s+le|date\s+d'audit)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    extract: (m) => normaliseDateFr(m[1]!),
    matchConfidence: 0.85,
  },
  {
    field: 'total_annual_consumption_kwh',
    // "123 456 kWh/an" or "1 234,5 MWh/an"
    pattern: /([\d\s]+[,.]?\d*)\s*(kWh|MWh|GWh|TEP|tep)\/an/i,
    extract: (m) => {
      const raw = parseFloat(parseFrenchNumber(m[1]!));
      const unit = m[2]!.toLowerCase();
      if (unit === 'mwh') return String(raw * 1000);
      if (unit === 'gwh') return String(raw * 1_000_000);
      if (unit === 'tep' || unit === 'TEP') return String(raw * 11630);
      return String(raw);
    },
    matchConfidence: 0.82,
  },
  {
    field: 'total_co2_kg',
    pattern: /([\d\s]+[,.]?\d*)\s*(?:kg|t(?:onnes?)?)\s*(?:CO2|éq\.?\s*CO2)/i,
    extract: (m) => {
      const raw = parseFloat(parseFrenchNumber(m[1]!));
      const unit = m[0]!.toLowerCase();
      // If tonnes, convert to kg
      if (unit.includes('tonne') || /\bt\b/.test(unit)) return String(raw * 1000);
      return String(raw);
    },
    matchConfidence: 0.8,
  },
];

// ─── Utility functions ────────────────────────────────────────────────────────

/** "01/03/2025" or "1-3-25" → "2025-03-01" */
function normaliseDateFr(raw: string): string {
  const parts = raw.split(/[\/\-]/);
  if (parts.length !== 3) return raw;
  const [d, mo, y] = parts as [string, string, string];
  const year = y.length === 2 ? `20${y}` : y;
  return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** "1 234,56" → "1234.56" */
function parseFrenchNumber(raw: string): string {
  return raw.replace(/\s/g, '').replace(',', '.').trim();
}

/** "m³" → "Nm3", etc. */
function normaliseUnit(raw: string): string {
  const map: Record<string, string> = {
    'm³': 'Nm3',
    'm3': 'Nm3',
    'kwh': 'kWh',
    'mwh': 'MWh',
    'gcal': 'Gcal',
  };
  return map[raw.toLowerCase()] ?? raw;
}

/** Map Tesseract confidence (0-100) to field confidence (0-1) */
function ocrConfToFieldConf(ocrConf: number): number {
  return Math.min(1, ocrConf / 100);
}

// ─── Pipeline B result shape ──────────────────────────────────────────────────

interface PartialExtraction {
  extracted: Record<string, unknown>;
  confidence: Record<string, number>;
  fieldsTotal: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class PipelineBService {
  private readonly logger = new Logger(PipelineBService.name);
  private _llm: ChatOpenAI | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly ocr: OcrService,
    private readonly cache: ExtractionCacheService,
  ) {}

  private get llm(): ChatOpenAI {
    if (!this._llm) {
      const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
      if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set — add it to .env or root .env');
      this._llm = new ChatOpenAI({
        apiKey,
        model: this.config.get<string>('OPENROUTER_MODEL', 'meta-llama/llama-3.3-70b-instruct'),
        temperature: 0,
        maxTokens: 2048,
        configuration: { baseURL: 'https://openrouter.ai/api/v1' },
      });
    }
    return this._llm;
  }

  // ─── Public entrypoints ──────────────────────────────────────────────────

  async extractBill(buffer: Buffer, kind: DocumentKind): Promise<PipelineResultDto> {
    const sha = createHash('sha256').update(buffer).digest('hex');
    const cacheKey = `pipelineB:bill:${sha}`;
    const t0 = performance.now();

    const cached = await this.cache.get<PipelineResultDto>(cacheKey);
    if (cached) return cached;

    const rawText = await this.getRawText(buffer, kind);
    const result = await this.extractBillFromText(rawText, sha);
    const processingMs = Math.round(performance.now() - t0);

    const dto = this.buildDto('LLM-Structured' as never, result, processingMs, 10);
    // Correct pipeline name
    (dto as { name: string }).name = 'OCR-Rules';

    await this.cache.set(cacheKey, dto, 60 * 60 * 24 * 7);
    return dto;
  }

  async extractExcel(buffer: Buffer, filename: string): Promise<PipelineResultDto> {
    const sha = createHash('sha256').update(buffer).digest('hex');
    const cacheKey = `pipelineB:excel:${sha}`;
    const t0 = performance.now();

    const cached = await this.cache.get<PipelineResultDto>(cacheKey);
    if (cached) return cached;

    const result = await this.extractExcelDirect(buffer, filename, sha);
    const processingMs = Math.round(performance.now() - t0);

    const dto = this.buildDto('OCR-Rules', result, processingMs, 6);
    await this.cache.set(cacheKey, dto, 60 * 60 * 24 * 7);
    return dto;
  }

  async extractAudit(buffer: Buffer): Promise<PipelineResultDto> {
    const sha = createHash('sha256').update(buffer).digest('hex');
    const cacheKey = `pipelineB:audit:${sha}`;
    const t0 = performance.now();

    const cached = await this.cache.get<PipelineResultDto>(cacheKey);
    if (cached) return cached;

    const parsed = await pdfParse(buffer);
    const rawText = parsed.text;

    const result = await this.extractAuditFromText(rawText, sha);
    const processingMs = Math.round(performance.now() - t0);

    const dto = this.buildDto('OCR-Rules', result, processingMs, 7);
    await this.cache.set(cacheKey, dto, 60 * 60 * 24 * 7);
    return dto;
  }

  // ─── Bill extraction ─────────────────────────────────────────────────────

  private async extractBillFromText(text: string, sha: string): Promise<PartialExtraction> {
    const extracted: Record<string, unknown> = {};
    const confidence: Record<string, number> = {};

    // Pass 1: regex
    for (const p of BILL_PATTERNS) {
      const match = text.match(p.pattern);
      if (match) {
        try {
          extracted[p.field] = p.extract(match);
          confidence[p.field] = p.matchConfidence ?? 0.85;
        } catch {
          // Extraction function threw — treat as no match
        }
      }
    }

    // Determine which fields need LLM fallback (confidence < 0.6 or missing)
    const allBillFields = [
      'supplier', 'account_number', 'period_start', 'period_end', 'issue_date',
      'consumption_value', 'consumption_unit', 'amount_ht', 'tva_rate', 'tva_amount', 'amount_ttc',
    ];

    const lowConfFields = allBillFields.filter(
      (f) => !extracted[f] || (confidence[f] ?? 0) < 0.6,
    );

    if (lowConfFields.length > 0) {
      // Pass 2: single constrained LLM call covering only the low-confidence fields
      this.logger.debug(
        `Bill PipelineB LLM fallback for sha=${sha.slice(0, 8)}: fields=${lowConfFields.join(',')}`,
      );
      const llmResult = await this.billLlmFallback(text, lowConfFields);
      for (const field of lowConfFields) {
        const v = llmResult[field];
        if (v !== null && v !== undefined) {
          extracted[field] = v;
          // LLM fallback gets a lower confidence — it might be inferred
          confidence[field] = 0.55;
        }
      }
    }

    return { extracted, confidence, fieldsTotal: allBillFields.length };
  }

  private async billLlmFallback(
    text: string,
    targetFields: string[],
  ): Promise<Record<string, unknown>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partialSchema = EnergyBillSchema.pick(
      Object.fromEntries(targetFields.map((f) => [f, true])) as any,
    );

    const structuredLlm = this.llm.withStructuredOutput(partialSchema, {
      name: 'extract_bill_fields_rules',
    });

    const fieldList = targetFields.join(', ');
    try {
      const result = await structuredLlm.invoke([
        new SystemMessage(EXTRACTION_PROMPTS.billRules),
        new HumanMessage(
          `Document type: Tunisian utility bill | SHA: ${text.slice(0, 8)}\n` +
            `Extract ONLY these fields: ${fieldList}\n\nOCR text:\n${text.slice(0, 3000)}`,
        ),
      ]);
      return result as Record<string, unknown>;
    } catch (err) {
      this.logger.warn(`Bill LLM fallback failed: ${(err as Error).message}`);
      return {};
    }
  }

  // ─── Excel extraction ─────────────────────────────────────────────────────

  private async extractExcelDirect(
    buffer: Buffer,
    filename: string,
    sha: string,
  ): Promise<PartialExtraction> {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const extracted: Record<string, unknown> = {
      file_name: filename,
      sheet_count: workbook.SheetNames.length,
    };
    const confidence: Record<string, number> = {
      file_name: 1.0,
      sheet_count: 1.0,
    };

    const entries: unknown[] = [];
    const warnings: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: null,
        raw: true,
      });

      if (rows.length === 0) {
        warnings.push(`Sheet "${sheetName}" is empty`);
        continue;
      }

      // Heuristic header sniff: skip rows until we find one with >= 2 string keys
      // matching energy column patterns, then treat that as the data start
      const dataRows = this.filterDataRows(rows);

      let rowIndex = 0;
      for (const row of dataRows) {
        const entry = this.mapRowToEntry(row, sheetName, rowIndex, sha);
        if (entry) entries.push(entry);
        rowIndex++;
      }
    }

    // If too few entries were mapped, call the LLM as fallback
    if (entries.length === 0 && workbook.SheetNames.length > 0) {
      this.logger.debug(`Excel PipelineB: no entries from regex — trying LLM for sha=${sha.slice(0, 8)}`);
      const llmEntries = await this.excelLlmFallback(buffer, filename, workbook, sha);
      entries.push(...llmEntries);
      // Mark LLM-sourced entries at lower confidence
      confidence['entries'] = 0.55;
    } else {
      confidence['entries'] = entries.length > 0 ? 0.8 : 0;
    }

    extracted['entries'] = entries;
    extracted['parsing_warnings'] = warnings;

    return { extracted, confidence, fieldsTotal: 6 };
  }

  private filterDataRows(
    rows: Record<string, unknown>[],
  ): Record<string, unknown>[] {
    // Skip rows where every cell is null or the row looks like a title
    return rows.filter((row) => {
      const values = Object.values(row);
      const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '');
      return nonNull.length >= 2;
    });
  }

  private mapRowToEntry(
    row: Record<string, unknown>,
    sheetName: string,
    rowIndex: number,
    _sha: string,
  ): unknown | null {
    // Look for a date-like column to set timestamp
    let timestamp: string | null = null;
    let energyType: string | null = null;
    let consumptionValue: number | null = null;
    let consumptionUnit: string | null = null;
    let cost: number | null = null;

    for (const [key, value] of Object.entries(row)) {
      const kl = key.toLowerCase();

      // Date detection
      if (!timestamp && (value instanceof Date || this.looksLikeDate(value))) {
        timestamp = value instanceof Date
          ? value.toISOString().slice(0, 10)
          : String(value);
      }

      // Energy type from column name
      if (!energyType) {
        if (/[eé]lec|kwh|mwh/.test(kl)) energyType = 'electricity';
        else if (/gaz|nm3/.test(kl)) energyType = 'natural_gas';
        else if (/vapeur|steam/.test(kl)) energyType = 'steam';
        else if (/froid|glac[eé]e/.test(kl)) energyType = 'cold_water';
        else if (/compresseur|air\s+comprim/.test(kl)) energyType = 'compressed_air';
        else if (/fioul|fuel/.test(kl)) energyType = 'fuel_oil';
      }

      // Consumption value: numeric cell in an energy column
      if (typeof value === 'number' && !Number.isNaN(value) && value > 0) {
        if (/[eé]lec|kwh|mwh|gaz|nm3|vapeur|froid|compresseur/.test(kl)) {
          consumptionValue = value;
          consumptionUnit = this.unitFromHeader(key);
        }
        if (/co[uû]t|montant|dt|tnd/.test(kl)) {
          cost = value;
        }
      }
    }

    // Require at least a consumption value to emit a row
    if (consumptionValue === null) return null;

    const entry: Record<string, unknown> = {
      sheet_name: sheetName,
      row_index: rowIndex,
    };
    if (timestamp) entry['timestamp'] = timestamp;
    if (energyType) entry['energy_type'] = energyType;
    if (consumptionValue !== null) entry['consumption_value'] = consumptionValue;
    if (consumptionUnit) entry['consumption_unit'] = consumptionUnit;
    if (cost !== null) entry['cost'] = cost;

    // Validate lightly with Zod
    const parsed = EnergyEntrySchema.safeParse(entry);
    return parsed.success ? parsed.data : entry;
  }

  private looksLikeDate(v: unknown): boolean {
    if (typeof v !== 'string') return false;
    return /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(v) ||
      /^(Janvier|F[eé]vrier|Mars|Avril|Mai|Juin|Juillet|Ao[uû]t|Septembre|Octobre|Novembre|D[eé]cembre)/i.test(v);
  }

  private unitFromHeader(header: string): string {
    const h = header.toLowerCase();
    if (/\(kwh\)/.test(h)) return 'kWh';
    if (/\(mwh\)/.test(h)) return 'MWh';
    if (/\(nm3\)/.test(h)) return 'Nm3';
    if (/\(gcal\)/.test(h)) return 'Gcal';
    if (/kwh/.test(h)) return 'kWh';
    if (/mwh/.test(h)) return 'MWh';
    return 'kWh'; // best guess
  }

  private async excelLlmFallback(
    _buffer: Buffer,
    filename: string,
    workbook: XLSX.WorkBook,
    sha: string,
  ): Promise<unknown[]> {
    const EntriesSchema = z.array(EnergyEntrySchema);
    const structuredLlm = this.llm.withStructuredOutput(EntriesSchema, {
      name: 'extract_excel_entries_rules',
    });

    // Build a compact preview of all sheets
    const sheetPreviews: string[] = [];
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: false });
      sheetPreviews.push(
        `Sheet: "${name}"\n${JSON.stringify(rows.slice(0, 20), null, 2).slice(0, 2000)}`,
      );
    }

    const preview = sheetPreviews.join('\n\n').slice(0, 6000);

    try {
      const result = await structuredLlm.invoke([
        new SystemMessage(EXTRACTION_PROMPTS.excelRules),
        new HumanMessage(
          `File: "${filename}" | SHA: ${sha.slice(0, 8)}\n\nSheet data:\n${preview}`,
        ),
      ]);
      return result as unknown[];
    } catch (err) {
      this.logger.warn(`Excel LLM fallback failed: ${(err as Error).message}`);
      return [];
    }
  }

  // ─── Audit extraction ─────────────────────────────────────────────────────

  private async extractAuditFromText(text: string, sha: string): Promise<PartialExtraction> {
    const extracted: Record<string, unknown> = {};
    const confidence: Record<string, number> = {};

    // Pass 1: regex
    for (const p of AUDIT_PATTERNS) {
      const match = text.match(p.pattern);
      if (match) {
        try {
          extracted[p.field] = p.extract(match);
          confidence[p.field] = p.matchConfidence ?? 0.8;
        } catch {
          // Extraction function threw — skip
        }
      }
    }

    const allAuditFields = [
      'site_name', 'audit_date', 'audit_firm', 'energy_sources',
      'total_annual_consumption_kwh', 'heat_sources', 'total_co2_kg',
    ];

    const lowConfFields = allAuditFields.filter(
      (f) => !extracted[f] || (confidence[f] ?? 0) < 0.6,
    );

    if (lowConfFields.length > 0) {
      this.logger.debug(
        `Audit PipelineB LLM fallback for sha=${sha.slice(0, 8)}: fields=${lowConfFields.join(',')}`,
      );
      const llmResult = await this.auditLlmFallback(text, sha);
      for (const field of lowConfFields) {
        const v = (llmResult as Record<string, unknown>)[field];
        if (v !== null && v !== undefined) {
          extracted[field] = v;
          confidence[field] = 0.55;
        }
      }
    }

    return { extracted, confidence, fieldsTotal: allAuditFields.length };
  }

  private async auditLlmFallback(text: string, sha: string): Promise<unknown> {
    const structuredLlm = this.llm.withStructuredOutput(AuditFlowSummarySchema, {
      name: 'extract_audit_rules',
    });
    try {
      const result = await structuredLlm.invoke([
        new SystemMessage(EXTRACTION_PROMPTS.auditRules),
        new HumanMessage(
          `Audit report | SHA: ${sha.slice(0, 8)}\n\nText:\n${text.slice(0, 8000)}`,
        ),
      ]);
      return result;
    } catch (err) {
      this.logger.warn(`Audit LLM fallback failed: ${(err as Error).message}`);
      return {};
    }
  }

  // ─── OCR helper ──────────────────────────────────────────────────────────

  private async getRawText(buffer: Buffer, kind: DocumentKind): Promise<string> {
    if (kind === 'native_pdf') {
      const parsed = await pdfParse(buffer);
      return parsed.text;
    }
    if (kind === 'scanned_pdf' || kind === 'scanned_image') {
      const result = await this.ocr.recognise(buffer);
      return result.text;
    }
    throw new Error(`PipelineB: unsupported document kind "${kind}"`);
  }

  // ─── DTO builder ──────────────────────────────────────────────────────────

  private buildDto(
    name: PipelineResultDto['name'],
    partial: PartialExtraction,
    processingMs: number,
    fieldsTotal: number,
  ): PipelineResultDto {
    const { extracted, confidence } = partial;
    const fieldsExtracted = Object.values(extracted).filter(
      (v) => v !== null && v !== undefined,
    ).length;

    return {
      name,
      extracted,
      fieldsExtracted,
      fieldsTotal: partial.fieldsTotal > 0 ? partial.fieldsTotal : fieldsTotal,
      extractionRate:
        partial.fieldsTotal > 0
          ? fieldsExtracted / partial.fieldsTotal
          : 0,
      qualityScore: 0, // filled by ComparisonService after validation
      processingMs,
      confidence,
    };
  }

  // ─── Validate Excel result for qualityScore (called externally) ───────────

  /**
   * Light-weight ExcelExtractionResult validation — returns
   * a value that can fill `qualityScore` on the PipelineResultDto.
   */
  validateExcelQuality(extracted: Record<string, unknown>): number {
    const parsed = ExcelExtractionResultSchema.safeParse(extracted);
    if (!parsed.success) return 0.2;
    const entries = parsed.data.entries;
    if (entries.length === 0) return 0;
    const filled = entries.map((e) => {
      const required = ['timestamp', 'energy_type', 'consumption_value', 'consumption_unit'];
      return required.filter((k) => e[k as keyof typeof e] !== null && e[k as keyof typeof e] !== undefined).length / required.length;
    });
    return filled.reduce((a, b) => a + b, 0) / filled.length;
  }
}
