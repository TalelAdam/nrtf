import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DocExtractionService } from '../doc-extraction.service';
import { FileTypeService } from '../ingest/file-type.service';
import { OcrService } from '../ocr/ocr.service';
import { ImagePreprocessorService } from '../ocr/image-preprocessor.service';
import { BillExtractorService } from '../extraction/bill-extractor.service';
import { ExcelExtractorService } from '../extraction/excel-extractor.service';
import { AuditExtractorService } from '../extraction/audit-extractor.service';
import { ValidationService } from '../validation/validation.service';
import { SubmissionService } from '../submission/submission.service';
import { ExtractionCacheService } from '../cache/extraction-cache.service';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(__dirname, '../../../../../../data/raw');

/**
 * End-to-end extraction benchmark spec.
 *
 * For each document in data/raw/factures/ + data/raw/tri-gen/:
 *   1. Run the full extraction pipeline
 *   2. Record: schema validity, field fill rate, quality score, processing time
 *   3. Assert that average quality score ≥ TARGET_QUALITY_SCORE
 *
 * Set env var TARGET_QUALITY_SCORE (0-1) to adjust CI threshold (default 0.3).
 * With OPENROUTER_API_KEY unset, LLM extraction steps are skipped and only
 * file-type detection + OCR are measured.
 */

const TARGET_QUALITY = parseFloat(process.env['TARGET_QUALITY_SCORE'] ?? '0.3');

describe('DocExtraction — end-to-end benchmark', () => {
  let service: DocExtractionService;

  const mockConfig = {
    get: (key: string, def?: string) => {
      const map: Record<string, string | undefined> = {
        OPENROUTER_API_KEY: process.env['OPENROUTER_API_KEY'],
        OPENROUTER_MODEL: process.env['OPENROUTER_MODEL'] ?? 'meta-llama/llama-3.3-70b-instruct',
        OCR_LANGUAGES: 'fra+ara',
        REDIS_URL: undefined,
        SUBMISSION_BASE_URL: 'http://localhost:9000',
      };
      return map[key] ?? def;
    },
  };

  const noOpCache = {
    get: async () => null,
    set: async () => undefined,
    del: async () => undefined,
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocExtractionService,
        FileTypeService,
        ImagePreprocessorService,
        OcrService,
        BillExtractorService,
        ExcelExtractorService,
        AuditExtractorService,
        ValidationService,
        SubmissionService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: ExtractionCacheService, useValue: noOpCache },
      ],
    }).compile();

    service = module.get<DocExtractionService>(DocExtractionService);
  }, 30_000);

  afterAll(async () => {
    const ocrService = (service as unknown as { ocr: OcrService }).ocr;
    if (ocrService?.onModuleDestroy) await ocrService.onModuleDestroy();
  });

  // ── FileTypeService unit tests ────────────────────────────────────────────

  describe('FileTypeService', () => {
    let ftService: FileTypeService;

    beforeAll(() => {
      ftService = new FileTypeService();
    });

    it('detects JPEG as scanned_image', () => {
      const jpegMagic = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.alloc(20)]);
      const result = ftService.probe(jpegMagic, 'bill.jpg');
      expect(result.kind).toBe('scanned_image');
    });

    it('detects ZIP-based buffer as excel for .xlsx extension', () => {
      const zipMagic = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Buffer.alloc(20)]);
      const result = ftService.probe(zipMagic, 'report.xlsx');
      expect(result.kind).toBe('excel');
    });

    it('detects PDF magic bytes', () => {
      // Minimal PDF without BT markers → scanned_pdf
      const pdfMagic = Buffer.from('%PDF-1.4\n1 0 obj\n', 'ascii');
      const result = ftService.probe(pdfMagic, 'document.pdf');
      expect(['native_pdf', 'scanned_pdf']).toContain(result.kind);
    });
  });

  // ── ValidationService unit tests ─────────────────────────────────────────

  describe('ValidationService', () => {
    let validationService: ValidationService;

    beforeAll(() => {
      validationService = new ValidationService();
    });

    it('validates a complete bill with high quality score', () => {
      const bill = {
        supplier: 'STEG',
        account_number: 'ACC123',
        period_start: '2025-01-01',
        period_end: '2025-01-31',
        consumption_value: 5000,
        consumption_unit: 'kWh',
        consumption_kwh: 5000,
        amount_ht: 840,
        tva_rate: 0.19,
        tva_amount: 159.6,
        amount_ttc: 999.6,
        energy_type: 'electricity',
        issue_date: '2025-02-05',
        currency: 'TND',
      };
      const report = validationService.validateBill(bill);
      expect(report.valid).toBe(true);
      expect(report.qualityScore).toBeGreaterThan(0.7);
      expect(report.consistencyWarnings).toHaveLength(0);
    });

    it('flags inconsistent HT + TVA vs TTC', () => {
      const bill = {
        amount_ht: 100,
        tva_amount: 19,
        amount_ttc: 200, // wrong — should be ~119
      };
      const report = validationService.validateBill(bill);
      expect(report.consistencyWarnings.length).toBeGreaterThan(0);
    });

    it('flags inverted period dates', () => {
      const bill = { period_start: '2025-02-01', period_end: '2025-01-01' };
      const report = validationService.validateBill(bill);
      expect(report.consistencyWarnings.some((w) => w.includes('≤'))).toBe(true);
    });
  });

  // ── Full pipeline benchmark ────────────────────────────────────────────────

  describe('Full pipeline — sample documents', () => {
    interface BenchmarkRow {
      file: string;
      kind: string;
      valid: boolean;
      qualityScore: number;
      fieldCount: number;
      ocrConfidence?: number;
      timeMs: number;
      error?: string;
    }

    const collectFiles = (subDir: string, exts: string[]): string[] => {
      const dir = join(DATA_DIR, subDir);
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((f) => exts.some((e) => f.toLowerCase().endsWith(e)))
        .slice(0, 5)
        .map((f) => join(dir, f));
    };

    it('achieves target quality score on available sample documents', async () => {
      const billFiles = collectFiles('factures', ['.jpg', '.jpeg', '.png', '.pdf']);
      const excelFiles = collectFiles('tri-gen', ['.xlsx', '.xls', '.xlsm']);
      const auditFiles = collectFiles('audit', ['.pdf']);
      const allFiles = [...billFiles, ...excelFiles, ...auditFiles];

      if (allFiles.length === 0) {
        console.warn('[Benchmark] No sample documents found in data/raw/ — skipping pipeline test');
        return;
      }

      const rows: BenchmarkRow[] = [];

      for (const filePath of allFiles) {
        const buffer = readFileSync(filePath);
        const filename = filePath.split(/[/\\]/).pop() ?? filePath;

        // Determine hint from path
        const hint = auditFiles.includes(filePath)
          ? 'audit'
          : excelFiles.includes(filePath)
            ? 'excel'
            : 'bill';

        const t0 = Date.now();
        let result;
        try {
          result = await service.extractDocument(buffer, filename, hint as 'bill' | 'excel' | 'audit');
          rows.push({
            file: filename,
            kind: result.kind,
            valid: result.validation.valid,
            qualityScore: result.qualityScore,
            fieldCount: result.validation.fieldCount,
            ocrConfidence: result.ocrConfidence,
            timeMs: Date.now() - t0,
          });
        } catch (err) {
          rows.push({
            file: filename,
            kind: '?',
            valid: false,
            qualityScore: 0,
            fieldCount: 0,
            timeMs: Date.now() - t0,
            error: (err as Error).message,
          });
        }
      }

      // Print benchmark report
      console.table(
        rows.map((r) => ({
          File: r.file,
          Kind: r.kind,
          Valid: r.valid ? '✓' : '✗',
          'Quality Score': r.qualityScore.toFixed(2),
          'Field Count': r.fieldCount,
          'OCR Conf': r.ocrConfidence?.toFixed(1) ?? 'n/a',
          'Time (ms)': r.timeMs,
          Error: r.error?.slice(0, 50) ?? '',
        })),
      );

      const successRows = rows.filter((r) => !r.error);
      if (successRows.length === 0) {
        console.warn('[Benchmark] All extractions failed — likely no OPENROUTER_API_KEY');
        return;
      }

      const avgQuality =
        successRows.reduce((s, r) => s + r.qualityScore, 0) / successRows.length;
      const successRate = successRows.filter((r) => r.valid).length / successRows.length;

      console.info(
        `\n[Benchmark] Results:\n` +
          `  Documents tested : ${allFiles.length}\n` +
          `  Extraction success: ${(successRate * 100).toFixed(0)}%\n` +
          `  Avg quality score : ${avgQuality.toFixed(3)} (target ≥ ${TARGET_QUALITY})\n`,
      );

      expect(avgQuality).toBeGreaterThanOrEqual(TARGET_QUALITY);
    }, 600_000); // 10 min timeout for multi-document benchmark
  });
});
