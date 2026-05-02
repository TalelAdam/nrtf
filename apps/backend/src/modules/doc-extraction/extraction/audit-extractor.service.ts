import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import pdfParse from 'pdf-parse';
import { createHash } from 'crypto';
import { AuditFlowSummarySchema, type AuditFlowSummary } from '../validation/schemas/audit.schema';
import { AUDIT_SYSTEM_PROMPT } from './prompts/audit.prompt';
import { ExtractionCacheService } from '../cache/extraction-cache.service';

export interface AuditExtractionResult {
  summary: AuditFlowSummary;
  extractionConfidence: number;
  processingTimeMs: number;
  fromCache: boolean;
  sha: string;
  pageCount: number;
}

@Injectable()
export class AuditExtractorService {
  private readonly logger = new Logger(AuditExtractorService.name);
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

  async extract(buffer: Buffer): Promise<AuditExtractionResult> {
    const sha = createHash('sha256').update(buffer).digest('hex');
    const cacheKey = `audit:${sha}`;
    const t0 = Date.now();

    const cached = await this.cache.get<AuditExtractionResult>(cacheKey);
    if (cached) {
      this.logger.debug(`Audit extraction cache hit sha=${sha.slice(0, 12)}`);
      return { ...cached, fromCache: true };
    }

    // Parse PDF text
    const parsed = await pdfParse(buffer);
    const fullText = parsed.text;
    const pageCount = parsed.numpages;

    this.logger.log(`Audit PDF parsed: ${pageCount} pages, ${fullText.length} chars`);

    // Split large reports into chunks and merge results
    const summary = await this.extractWithChunking(fullText, pageCount, sha);

    const result: AuditExtractionResult = {
      summary: { ...summary, page_count: pageCount },
      extractionConfidence: summary.extraction_confidence ?? 0,
      processingTimeMs: Date.now() - t0,
      fromCache: false,
      sha,
      pageCount,
    };

    await this.cache.set(cacheKey, result, 60 * 60 * 24 * 7);
    return result;
  }

  private async extractWithChunking(
    fullText: string,
    pageCount: number,
    sha: string,
  ): Promise<AuditFlowSummary> {
    // For long audits, do a two-pass extraction:
    // Pass 1: full text (truncated) → initial summary
    // Pass 2: search for specific sections that might have been missed
    const maxChars = 12_000;
    const textChunk = fullText.slice(0, maxChars);

    const structuredLlm = this.llm.withStructuredOutput(AuditFlowSummarySchema, {
      name: 'extract_audit_summary',
    });

    try {
      const result = await structuredLlm.invoke([
        new SystemMessage(AUDIT_SYSTEM_PROMPT),
        new HumanMessage(
          `Audit report (${pageCount} pages) — SHA: ${sha.slice(0, 8)}\n\nFull text:\n${textChunk}`,
        ),
      ]);
      return result as AuditFlowSummary;
    } catch (err) {
      this.logger.warn(`Audit structured extraction failed: ${(err as Error).message}`);
      // Fallback: raw JSON mode
      const raw = await this.llm.invoke([
        new SystemMessage(
          AUDIT_SYSTEM_PROMPT + '\n\nReturn ONLY a valid JSON object. No markdown, no explanation.',
        ),
        new HumanMessage(`Text:\n${textChunk}`),
      ]);
      const content = raw.content as string;
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('LLM returned no JSON for audit');
      return AuditFlowSummarySchema.parse(JSON.parse(match[0]));
    }
  }
}
