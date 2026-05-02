import {
  Injectable,
  Logger,
  BadRequestException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { FileTypeService } from './ingest/file-type.service';
import { OcrService } from './ocr/ocr.service';
import { BillExtractorService } from './extraction/bill-extractor.service';
import { ExcelExtractorService } from './extraction/excel-extractor.service';
import { AuditExtractorService } from './extraction/audit-extractor.service';
import { ValidationService } from './validation/validation.service';
import { SubmissionService, type SubmittablePayload } from './submission/submission.service';
import type { ExtractionResultDto, SubmissionResultDto } from './dto/extraction-result.dto';

@Injectable()
export class DocExtractionService {
  private readonly logger = new Logger(DocExtractionService.name);

  constructor(
    private readonly fileType: FileTypeService,
    private readonly ocr: OcrService,
    private readonly billExtractor: BillExtractorService,
    private readonly excelExtractor: ExcelExtractorService,
    private readonly auditExtractor: AuditExtractorService,
    private readonly validation: ValidationService,
    private readonly submission: SubmissionService,
  ) {}

  /** Route a file to the correct extractor and validate the result */
  async extractDocument(
    buffer: Buffer,
    filename: string,
    hint?: 'bill' | 'excel' | 'audit',
  ): Promise<ExtractionResultDto> {
    const probe = this.fileType.probe(buffer, filename);
    this.logger.log(`Processing: ${filename} → kind=${probe.kind}, size=${probe.sizeBytes}B`);

    if (probe.kind === 'unknown') {
      throw new UnsupportedMediaTypeException(
        `Unsupported file type for: ${filename}. Supported: PDF, JPEG, PNG, XLSX.`,
      );
    }

    try {
      // --- EXCEL ---
      if (probe.kind === 'excel') {
        const { result, processingTimeMs, fromCache, sha } = await this.excelExtractor.extract(
          buffer,
          filename,
        );
        const validation = this.validation.validateExcel(result);
        return {
          kind: 'excel',
          sha,
          success: validation.valid,
          data: result,
          validation,
          qualityScore: validation.qualityScore,
          processingTimeMs,
          fromCache,
        };
      }

      // --- AUDIT (hint or very large PDF) ---
      if (hint === 'audit' || (probe.kind === 'native_pdf' && probe.sizeBytes > 100_000)) {
        const { summary, processingTimeMs, fromCache, sha } = await this.auditExtractor.extract(buffer);
        const validation = this.validation.validateAudit(summary);
        return {
          kind: 'audit',
          sha,
          success: validation.valid,
          data: summary,
          validation,
          qualityScore: validation.qualityScore,
          processingTimeMs,
          fromCache,
        };
      }

      // --- BILL (default for PDF + image) ---
      const { bill, ocrConfidence, processingTimeMs, fromCache, sha } =
        await this.billExtractor.extract(buffer, probe.kind);
      const validation = this.validation.validateBill(bill);
      return {
        kind: probe.kind,
        sha,
        success: validation.valid,
        data: bill,
        validation,
        qualityScore: validation.qualityScore,
        ocrConfidence,
        processingTimeMs,
        fromCache,
      };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Extraction failed for ${filename}: ${message}`);
      return {
        kind: probe.kind,
        sha: '',
        success: false,
        data: null,
        validation: { valid: false, fieldCount: 0, nullFields: [], errors: [message], consistencyWarnings: [], qualityScore: 0 },
        qualityScore: 0,
        processingTimeMs: 0,
        fromCache: false,
        error: message,
      };
    }
  }

  /** Dedicated bill endpoint — validates that the document is a bill before extraction */
  async extractBill(buffer: Buffer, filename: string): Promise<ExtractionResultDto> {
    return this.extractDocument(buffer, filename, 'bill');
  }

  /** Dedicated audit endpoint */
  async extractAudit(buffer: Buffer, filename: string): Promise<ExtractionResultDto> {
    return this.extractDocument(buffer, filename, 'audit');
  }

  /** Submit an extraction result to the challenge platform */
  async submitToChallenge(
    type: 'bill' | 'excel' | 'audit',
    data: unknown,
  ): Promise<SubmissionResultDto> {
    if (!data) throw new BadRequestException('No data to submit');
    const payload: SubmittablePayload = { type, data } as SubmittablePayload;
    return this.submission.submit(payload);
  }
}
