import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWorker, Worker, RecognizeResult } from 'tesseract.js';
import { createHash } from 'crypto';
import { ImagePreprocessorService } from './image-preprocessor.service';
import { ExtractionCacheService } from '../cache/extraction-cache.service';

export interface OcrResult {
  text: string;
  /** Overall Tesseract confidence 0-100 */
  confidence: number;
  /** Word-level detail for provenance */
  words: Array<{ text: string; confidence: number; bbox: [number, number, number, number] }>;
  engine: 'tesseract';
  language: string;
  processingTimeMs: number;
  /** SHA-256 of the raw image buffer — used as cache key */
  imageSha: string;
  /** Whether result came from cache */
  fromCache: boolean;
}

/**
 * Wraps tesseract.js for OCR of scanned images and image-based PDFs.
 *
 * Language priority for Tunisian energy bills:
 *   fra+ara  → covers French (primary) + Arabic (secondary headers / amounts)
 *
 * The worker is initialised once on module init and reused across requests.
 */
@Injectable()
export class OcrService implements OnModuleDestroy {
  private readonly logger = new Logger(OcrService.name);
  private worker: Worker | null = null;
  /** Active language combination — override via OCR_LANGUAGES env var */
  private readonly language: string;

  constructor(
    private readonly config: ConfigService,
    private readonly preprocessor: ImagePreprocessorService,
    private readonly cache: ExtractionCacheService,
  ) {
    this.language = this.config.get<string>('OCR_LANGUAGES', 'fra+ara');
  }

  /** Lazily initialise the Tesseract worker on first use */
  private async getWorker(): Promise<Worker> {
    if (this.worker) return this.worker;

    this.logger.log(`Initialising Tesseract worker (lang=${this.language})`);
    this.worker = await createWorker(this.language, 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') {
          this.logger.verbose(`OCR progress: ${(m.progress * 100).toFixed(0)}%`);
        }
      },
    });
    return this.worker;
  }

  /**
   * Run OCR on an image buffer (JPEG, PNG, TIFF, BMP).
   * Preprocessing (greyscale → normalise → binarise) is applied first.
   *
   * Results are cached by SHA-256 of the raw (pre-processed) buffer.
   */
  async recognise(rawImageBuffer: Buffer, skipPreprocess = false): Promise<OcrResult> {
    const imageSha = createHash('sha256').update(rawImageBuffer).digest('hex');
    const cacheKey = `ocr:${this.language}:${imageSha}`;

    // Try cache first
    const cached = await this.cache.get<OcrResult>(cacheKey);
    if (cached) {
      this.logger.debug(`OCR cache hit for sha=${imageSha.slice(0, 12)}`);
      return { ...cached, fromCache: true };
    }

    // Preprocess
    const imageBuffer = skipPreprocess
      ? rawImageBuffer
      : (await this.preprocessor.preprocess(rawImageBuffer)).buffer;

    const t0 = Date.now();
    const worker = await this.getWorker();
    const result: RecognizeResult = await worker.recognize(imageBuffer);
    const processingTimeMs = Date.now() - t0;

    const words = (result.data.words ?? []).map((w) => ({
      text: w.text,
      confidence: w.confidence,
      bbox: [w.bbox.x0, w.bbox.y0, w.bbox.x1, w.bbox.y1] as [number, number, number, number],
    }));

    const ocrResult: OcrResult = {
      // Strip control characters and null bytes that corrupt downstream JSON parsing
      text: result.data.text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uFFFD]/g, ' '),
      confidence: result.data.confidence,
      words,
      engine: 'tesseract',
      language: this.language,
      processingTimeMs,
      imageSha,
      fromCache: false,
    };

    this.logger.log(
      `OCR completed: confidence=${result.data.confidence.toFixed(1)}, ` +
        `words=${words.length}, time=${processingTimeMs}ms`,
    );

    await this.cache.set(cacheKey, ocrResult, 60 * 60 * 24 * 7); // 7 days
    return ocrResult;
  }

  /**
   * Score-focused benchmark method: returns detailed per-word metrics.
   * Used by extraction-benchmark.spec.ts to compare OCR configurations.
   */
  async benchmark(
    rawImageBuffer: Buffer,
  ): Promise<{ confidence: number; wordCount: number; highConfidenceWordRate: number; text: string }> {
    const result = await this.recognise(rawImageBuffer, false);
    const highConf = result.words.filter((w) => w.confidence >= 70).length;
    return {
      confidence: result.confidence,
      wordCount: result.words.length,
      highConfidenceWordRate: result.words.length > 0 ? highConf / result.words.length : 0,
      text: result.text,
    };
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}
