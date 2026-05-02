import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { createHash } from 'crypto';
import {
  EnergyEntrySchema,
  ExcelExtractionResultSchema,
  type ExcelExtractionResult,
} from '../validation/schemas/excel-entry.schema';
import { EXCEL_SYSTEM_PROMPT, EXCEL_HEADER_DETECTION_PROMPT } from './prompts/excel.prompt';
import { ExtractionCacheService } from '../cache/extraction-cache.service';

const HeaderDetectionSchema = z.object({
  headerRowIndex: z.number().int().nonnegative(),
  reasoning: z.string().optional(),
});

export interface ExcelExtractionServiceResult {
  result: ExcelExtractionResult;
  processingTimeMs: number;
  fromCache: boolean;
  sha: string;
}

@Injectable()
export class ExcelExtractorService {
  private readonly logger = new Logger(ExcelExtractorService.name);
  private _llm: ChatOpenAI | null = null;

  constructor(
    private readonly config: ConfigService,
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
        maxTokens: 4096,
        configuration: { baseURL: 'https://openrouter.ai/api/v1' },
      });
    }
    return this._llm;
  }

  async extract(buffer: Buffer, filename: string): Promise<ExcelExtractionServiceResult> {
    const sha = createHash('sha256').update(buffer).digest('hex');
    const cacheKey = `excel:${sha}`;
    const t0 = Date.now();

    const cached = await this.cache.get<ExcelExtractionServiceResult>(cacheKey);
    if (cached) {
      this.logger.debug(`Excel extraction cache hit sha=${sha.slice(0, 12)}`);
      return { ...cached, fromCache: true };
    }

    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const warnings: string[] = [];
    const allEntries: z.infer<typeof EnergyEntrySchema>[] = [];
    const headerRows: Record<string, number> = {};

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      // Convert sheet to array of arrays (raw rows)
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: null,
        raw: false,
      });

      if (rows.length < 2) {
        warnings.push(`Sheet "${sheetName}" has < 2 rows — skipped`);
        continue;
      }

      // Detect header row
      const headerIdx = await this.detectHeaderRow(rows.slice(0, 10), sheetName);
      headerRows[sheetName] = headerIdx;

      // Slice data rows and send to LLM for structured extraction
      const dataRows = rows.slice(headerIdx);
      const entries = await this.extractEntriesFromSheet(dataRows, sheetName, sha);
      allEntries.push(...entries);
    }

    const result: ExcelExtractionResult = ExcelExtractionResultSchema.parse({
      file_name: filename,
      sheet_count: workbook.SheetNames.length,
      entries: allEntries,
      header_rows: headerRows,
      parsing_warnings: warnings,
      extraction_confidence: allEntries.length > 0 ? 0.8 : 0.1,
    });

    const serviceResult: ExcelExtractionServiceResult = {
      result,
      processingTimeMs: Date.now() - t0,
      fromCache: false,
      sha,
    };

    await this.cache.set(cacheKey, serviceResult, 60 * 60 * 24 * 7);
    return serviceResult;
  }

  private async detectHeaderRow(
    previewRows: unknown[][],
    sheetName: string,
  ): Promise<number> {
    if (previewRows.length === 0) return 0;

    try {
      const structuredLlm = this.llm.withStructuredOutput(HeaderDetectionSchema);
      const result = await structuredLlm.invoke([
        new SystemMessage(EXCEL_HEADER_DETECTION_PROMPT),
        new HumanMessage(
          `Sheet name: "${sheetName}"\nFirst rows:\n${JSON.stringify(previewRows, null, 2)}`,
        ),
      ]);
      return (result as z.infer<typeof HeaderDetectionSchema>).headerRowIndex;
    } catch {
      return 0; // default to first row
    }
  }

  private async extractEntriesFromSheet(
    rows: unknown[][],
    sheetName: string,
    sha: string,
  ): Promise<z.infer<typeof EnergyEntrySchema>[]> {
    if (rows.length === 0) return [];

    // Limit to first 200 rows to avoid token explosion
    const sampleRows = rows.slice(0, 200);
    const rowsJson = JSON.stringify(sampleRows, null, 2).slice(0, 8000);

    const EntriesArraySchema = z.array(EnergyEntrySchema);
    const structuredLlm = this.llm.withStructuredOutput(EntriesArraySchema, {
      name: 'extract_energy_entries',
    });

    try {
      const result = await structuredLlm.invoke([
        new SystemMessage(EXCEL_SYSTEM_PROMPT),
        new HumanMessage(
          `Sheet: "${sheetName}" | SHA: ${sha.slice(0, 8)}\nRows (header first):\n${rowsJson}`,
        ),
      ]);
      return result as z.infer<typeof EntriesArraySchema>;
    } catch (err) {
      this.logger.warn(`Excel LLM extraction failed for sheet "${sheetName}": ${(err as Error).message}`);
      return [];
    }
  }
}
