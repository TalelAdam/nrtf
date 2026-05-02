import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OcrService } from '../ocr/ocr.service';
import { ImagePreprocessorService } from '../ocr/image-preprocessor.service';
import { ExtractionCacheService } from '../cache/extraction-cache.service';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * OCR Benchmark Spec
 *
 * Runs tesseract.js against sample images in data/raw/factures/ and reports:
 *   - Overall confidence (0-100)
 *   - Word count
 *   - High-confidence word rate (words with confidence ≥ 70%)
 *   - Processing time per document
 *
 * Run with: pnpm --filter backend test -- --testPathPattern=ocr.service.spec
 *
 * Set TARGET_OCR_CONFIDENCE=50 (env) to override the minimum acceptable
 * confidence threshold for the CI assertion.
 */

const SAMPLE_DIR = join(__dirname, '../../../../../../data/raw/factures');
const TARGET_CONFIDENCE = parseInt(process.env['TARGET_OCR_CONFIDENCE'] ?? '40', 10);
const TARGET_WORD_RATE = parseFloat(process.env['TARGET_HIGH_CONF_WORD_RATE'] ?? '0.5');

describe('OcrService', () => {
  let service: OcrService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OcrService,
        ImagePreprocessorService,
        {
          provide: ConfigService,
          useValue: { get: (key: string, def?: string) => (key === 'OCR_LANGUAGES' ? 'fra+ara' : def) },
        },
        {
          provide: ExtractionCacheService,
          useValue: { get: async () => null, set: async () => undefined },
        },
      ],
    }).compile();

    service = module.get<OcrService>(OcrService);
  }, 60_000);

  afterAll(async () => {
    // Worker cleanup happens via OnModuleDestroy — call manually in tests
    await (service as unknown as { onModuleDestroy(): Promise<void> }).onModuleDestroy();
  });

  describe('benchmark against sample documents', () => {
    let imageFiles: string[] = [];

    beforeAll(() => {
      if (!existsSync(SAMPLE_DIR)) {
        console.warn(`[OCR Benchmark] Sample dir not found: ${SAMPLE_DIR} — skipping file tests`);
        return;
      }
      imageFiles = readdirSync(SAMPLE_DIR)
        .filter((f) => /\.(jpg|jpeg|png|tiff?|bmp)$/i.test(f))
        .slice(0, 10) // limit to first 10 to keep CI fast
        .map((f) => join(SAMPLE_DIR, f));
      console.info(`[OCR Benchmark] Testing ${imageFiles.length} sample images from ${SAMPLE_DIR}`);
    });

    it('should achieve minimum confidence threshold on sample bills', async () => {
      if (imageFiles.length === 0) {
        console.warn('[OCR Benchmark] No image files found — test skipped');
        return;
      }

      const results: Array<{
        file: string;
        confidence: number;
        wordCount: number;
        highConfidenceWordRate: number;
        timeMs: number;
      }> = [];

      for (const filePath of imageFiles) {
        const buffer = readFileSync(filePath);
        const t0 = Date.now();
        const bm = await service.benchmark(buffer);
        results.push({
          file: filePath.split(/[/\\]/).pop() ?? filePath,
          confidence: bm.confidence,
          wordCount: bm.wordCount,
          highConfidenceWordRate: bm.highConfidenceWordRate,
          timeMs: Date.now() - t0,
        });
      }

      // Print tabular benchmark report
      console.table(
        results.map((r) => ({
          File: r.file,
          Confidence: r.confidence.toFixed(1),
          Words: r.wordCount,
          'High-Conf Rate': (r.highConfidenceWordRate * 100).toFixed(1) + '%',
          'Time (ms)': r.timeMs,
        })),
      );

      const avgConfidence = results.reduce((s, r) => s + r.confidence, 0) / results.length;
      const avgHighConfRate = results.reduce((s, r) => s + r.highConfidenceWordRate, 0) / results.length;

      console.info(
        `[OCR Benchmark] Avg confidence: ${avgConfidence.toFixed(1)} / 100` +
          ` | Avg high-conf word rate: ${(avgHighConfRate * 100).toFixed(1)}%` +
          ` | Target confidence: ${TARGET_CONFIDENCE}` +
          ` | Target word rate: ${(TARGET_WORD_RATE * 100).toFixed(0)}%`,
      );

      // Scoring assertion — CI will fail if OCR degrades below the threshold
      expect(avgConfidence).toBeGreaterThanOrEqual(TARGET_CONFIDENCE);
      expect(avgHighConfRate).toBeGreaterThanOrEqual(TARGET_WORD_RATE);
    }, 300_000); // 5 min timeout for OCR on multiple files
  });

  describe('unit: recognise', () => {
    it('should return structured OCR result for a synthetic PNG', async () => {
      // Create a minimal 1x1 white PNG buffer
      const whitePng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==',
        'base64',
      );

      const result = await service.recognise(whitePng);
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(result.engine).toBe('tesseract');
      expect(result.language).toBe('fra+ara');
      expect(typeof result.processingTimeMs).toBe('number');
    }, 60_000);
  });
});
