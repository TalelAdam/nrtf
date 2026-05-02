import { ApiProperty } from '@nestjs/swagger';
import type { ValidationReport } from '../validation/validation.service';

/** Unified extraction response envelope */
export class ExtractionResultDto {
  @ApiProperty({ description: 'Detected document kind' })
  kind!: string;

  @ApiProperty({ description: 'SHA-256 of the submitted file' })
  sha!: string;

  @ApiProperty({ description: 'Extraction success flag' })
  success!: boolean;

  @ApiProperty({ description: 'Structured extraction output (bill, excel entries, or audit summary)' })
  data!: unknown;

  @ApiProperty({ description: 'Validation report from Zod + cross-field checks' })
  validation!: ValidationReport;

  @ApiProperty({ description: 'Overall quality score 0-1' })
  qualityScore!: number;

  @ApiProperty({ description: 'OCR engine confidence 0-100 (null for native PDFs / Excel)' })
  ocrConfidence?: number;

  @ApiProperty({ description: 'Total processing time in milliseconds' })
  processingTimeMs!: number;

  @ApiProperty({ description: 'Whether result was served from cache' })
  fromCache!: boolean;

  @ApiProperty({ description: 'Error message if success=false', required: false })
  error?: string;
}

export class SubmissionResultDto {
  @ApiProperty()
  accepted!: boolean;

  @ApiProperty({ description: 'F1 score from the platform (0-1)', required: false })
  f1?: number;

  @ApiProperty({ description: 'HTTP status returned by the platform' })
  httpStatus!: number;

  @ApiProperty({ description: 'Full response body from platform', required: false })
  details?: unknown;

  @ApiProperty({ required: false })
  error?: string;
}
