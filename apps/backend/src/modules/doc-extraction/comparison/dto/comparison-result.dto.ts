import { ApiProperty } from '@nestjs/swagger';
import type { FieldAccuracy, AccuracyReport } from '../accuracy.service';

// ─── Re-export the accuracy types so callers can import from one place ────────
export type { FieldAccuracy, AccuracyReport };

// ─── Per-pipeline result ──────────────────────────────────────────────────────

export class PipelineResultDto {
  @ApiProperty({
    enum: ['LLM-Structured', 'OCR-Rules'],
    description: 'Human-readable pipeline identifier',
  })
  name!: 'LLM-Structured' | 'OCR-Rules';

  @ApiProperty({
    description: 'Extracted key-value pairs (null = field not found)',
    type: 'object',
    additionalProperties: true,
  })
  extracted!: Record<string, unknown>;

  @ApiProperty({ description: 'Number of fields with a non-null value' })
  fieldsExtracted!: number;

  @ApiProperty({ description: 'Total schema fields considered' })
  fieldsTotal!: number;

  @ApiProperty({ description: 'fieldsExtracted / fieldsTotal', minimum: 0, maximum: 1 })
  extractionRate!: number;

  @ApiProperty({ description: 'Zod validation quality score 0-1', minimum: 0, maximum: 1 })
  qualityScore!: number;

  @ApiProperty({ description: 'Wall-clock time from buffer intake to result, in milliseconds' })
  processingMs!: number;

  @ApiProperty({
    description: 'Per-field confidence scores 0-1',
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  confidence!: Record<string, number>;
}

// ─── Document metadata ────────────────────────────────────────────────────────

export class DocumentMetaDto {
  @ApiProperty({ description: 'Original filename as supplied by the caller' })
  name!: string;

  @ApiProperty({ description: 'MIME type detected from magic bytes + extension' })
  mimeType!: string;

  @ApiProperty({ description: 'File size in bytes' })
  sizeBytes!: number;
}

// ─── Top-level comparison result ──────────────────────────────────────────────

export class ComparisonResultDto {
  @ApiProperty({ description: 'File metadata' })
  document!: DocumentMetaDto;

  @ApiProperty({ description: 'Pipeline A — full LLM-structured extraction result', type: PipelineResultDto })
  pipelineA!: PipelineResultDto;

  @ApiProperty({ description: 'Pipeline B — regex-first + constrained-LLM fallback result', type: PipelineResultDto })
  pipelineB!: PipelineResultDto;

  @ApiProperty({
    description:
      'Field-by-field comparison: agreement rate, winner, quality scores, processing times',
  })
  // AccuracyReport is a plain object, not a class — we keep the type annotation
  // as `unknown` in the decorator and use the typed interface in code.
  accuracy!: AccuracyReport;
}
