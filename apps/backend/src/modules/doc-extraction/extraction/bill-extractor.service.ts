import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import pdfParse from 'pdf-parse';
import { createHash } from 'crypto';
import { EnergyBillSchema, type EnergyBill } from '../validation/schemas/bill.schema';
import { BILL_SYSTEM_PROMPT } from './prompts/bill.prompt';
import { OcrService } from '../ocr/ocr.service';
import { ExtractionCacheService } from '../cache/extraction-cache.service';
import type { DocumentKind } from '../ingest/file-type.service';

export interface BillExtractionResult {
  bill: EnergyBill;
  ocrConfidence?: number;
  extractionConfidence: number;
  processingTimeMs: number;
  fromCache: boolean;
  sha: string;
}

@Injectable()
export class BillExtractorService {
  private readonly logger = new Logger(BillExtractorService.name);
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

  async extract(
    buffer: Buffer,
    kind: DocumentKind,
  ): Promise<BillExtractionResult> {
    const sha = createHash('sha256').update(buffer).digest('hex');
    const cacheKey = `bill:${sha}`;
    const t0 = Date.now();

    const cached = await this.cache.get<BillExtractionResult>(cacheKey);
    if (cached) {
      this.logger.debug(`Bill extraction cache hit sha=${sha.slice(0, 12)}`);
      return { ...cached, fromCache: true };
    }

    let rawText: string;
    let ocrConfidence: number | undefined;

    if (kind === 'native_pdf') {
      const parsed = await pdfParse(buffer);
      rawText = parsed.text;
    } else if (kind === 'scanned_pdf' || kind === 'scanned_image') {
      const ocrResult = await this.ocr.recognise(buffer);
      rawText = ocrResult.text;
      ocrConfidence = ocrResult.confidence;
    } else {
      throw new Error(`BillExtractor does not support document kind: ${kind}`);
    }

    const bill = await this.extractFromText(rawText, sha);

    const result: BillExtractionResult = {
      bill,
      ocrConfidence,
      extractionConfidence: bill.extraction_confidence ?? 0,
      processingTimeMs: Date.now() - t0,
      fromCache: false,
      sha,
    };

    await this.cache.set(cacheKey, result, 60 * 60 * 24 * 7);
    return result;
  }

  private async extractFromText(text: string, sha: string): Promise<EnergyBill> {
    // Sanitize OCR text: strip control characters and non-printable bytes that
    // corrupt LLM JSON output (e.g. \u0008 sequences from tesseract garbage).
    // Keep printable ASCII + common Arabic/French Unicode blocks.
    const sanitized = text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ') // control chars
      .replace(/\uFFFD/g, ' ')                              // replacement char
      .replace(/ {3,}/g, '  ')                              // collapse excess spaces
      .slice(0, 4000);

    const structuredLlm = this.llm.withStructuredOutput(EnergyBillSchema, {
      name: 'extract_energy_bill',
    });

    try {
      const result = await structuredLlm.invoke([
        new SystemMessage(BILL_SYSTEM_PROMPT),
        new HumanMessage(
          `Document type: Tunisian utility bill\nSHA: ${sha.slice(0, 8)}\n\nOCR / PDF text:\n${sanitized}`,
        ),
      ]);
      return result as EnergyBill;
    } catch (err) {
      this.logger.warn(`Structured output failed, retrying with raw JSON: ${(err as Error).message}`);
      // Fallback: ask for raw JSON, strip any markdown fences
      try {
        const rawResult = await this.llm.invoke([
          new SystemMessage(
            BILL_SYSTEM_PROMPT +
              '\n\nRespond ONLY with a valid JSON object. No markdown, no explanation, no ocr_raw_text field.',
          ),
          new HumanMessage(`OCR text:\n${sanitized}`),
        ]);
        const content = (rawResult.content as string)
          .replace(/```json?\n?/gi, '')
          .replace(/```/g, '')
          .trim();
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('LLM returned no JSON object');
        const parsed = JSON.parse(jsonMatch[0]) as unknown;
        return EnergyBillSchema.parse(parsed);
      } catch (innerErr) {
        this.logger.error(`Both extraction paths failed: ${(innerErr as Error).message}`);
        // Return minimal valid bill rather than crashing the request
        return EnergyBillSchema.parse({ extraction_confidence: 0.1 });
      }
    }
  }
}
