import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DocExtractionController } from './doc-extraction.controller';
import { DocExtractionService } from './doc-extraction.service';
import { FileTypeService } from './ingest/file-type.service';
import { ImagePreprocessorService } from './ocr/image-preprocessor.service';
import { OcrService } from './ocr/ocr.service';
import { BillExtractorService } from './extraction/bill-extractor.service';
import { ExcelExtractorService } from './extraction/excel-extractor.service';
import { AuditExtractorService } from './extraction/audit-extractor.service';
import { ValidationService } from './validation/validation.service';
import { SubmissionService } from './submission/submission.service';
import { ExtractionCacheService } from './cache/extraction-cache.service';

@Module({
  imports: [ConfigModule],
  controllers: [DocExtractionController],
  providers: [
    // Core orchestration
    DocExtractionService,
    // Ingest
    FileTypeService,
    // OCR pipeline
    ImagePreprocessorService,
    OcrService,
    // Extractors (one per document class)
    BillExtractorService,
    ExcelExtractorService,
    AuditExtractorService,
    // Validation
    ValidationService,
    // Submission
    SubmissionService,
    // Cache (Redis with memory fallback)
    ExtractionCacheService,
  ],
  /**
   * Export DocExtractionService so the ai-agents bridge and other modules
   * can trigger extractions programmatically.
   */
  exports: [DocExtractionService, ValidationService],
})
export class DocExtractionModule {}
