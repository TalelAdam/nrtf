import {
  Controller,
  Post,
  Req,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { ComparisonService } from './comparison.service';
import { ComparisonResultDto } from './dto/comparison-result.dto';

/**
 * ComparisonController — Part 2 evaluation endpoint.
 *
 * POST /extract/compare
 *   Accepts the same multipart/form-data or base64 JSON body as POST /extract/document.
 *   Runs Pipeline A (LLM-Structured) and Pipeline B (OCR-Rules) in parallel, then
 *   returns a full field-level comparison report.
 *
 * This controller is additive — existing /extract/* endpoints are untouched.
 */
@ApiTags('doc-extraction')
@Controller('extract')
export class ComparisonController {
  private readonly logger = new Logger(ComparisonController.name);

  constructor(private readonly comparison: ComparisonService) {}

  @Post('compare')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary: 'Run both extraction pipelines in parallel and return field-level comparison',
    description:
      'Pipeline A: LLM-structured (existing extractors + Zod validation). ' +
      'Pipeline B: regex/pattern-first, constrained-LLM fallback. ' +
      'Returns accuracy report with agreement rate, winner, and per-field breakdown.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: ComparisonResultDto,
    description: 'Dual-pipeline comparison result',
  })
  @ApiBody({
    schema: {
      oneOf: [
        {
          type: 'object',
          required: ['file'],
          properties: { file: { type: 'string', format: 'binary' } },
        },
        {
          type: 'object',
          required: ['base64'],
          properties: {
            base64: { type: 'string', description: 'Base64-encoded file content' },
            filename: { type: 'string', description: 'Original filename with extension' },
          },
        },
      ],
    },
  })
  async compareDocument(@Req() req: FastifyRequest): Promise<ComparisonResultDto> {
    const { buffer, filename } = await this.resolveFile(req);
    this.logger.log(`Compare request: ${filename} (${buffer.length} bytes)`);
    return this.comparison.compare(buffer, filename);
  }

  // ─── File resolution (mirrors DocExtractionController.resolveFile) ────────

  private async resolveFile(
    req: FastifyRequest,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const contentType = req.headers['content-type'] ?? '';

    if (contentType.includes('multipart/form-data')) {
      // Fastify multipart — req.file() is injected by @fastify/multipart
      const data = await (
        req as FastifyRequest & {
          file(): Promise<{ toBuffer(): Promise<Buffer>; filename: string }>;
        }
      ).file();
      if (!data) throw new BadRequestException('No file field in multipart body');
      const buffer = await data.toBuffer();
      return { buffer, filename: data.filename ?? 'upload' };
    }

    const body = req.body as { base64?: string; filename?: string } | undefined;
    if (body?.base64) {
      const buffer = Buffer.from(body.base64, 'base64');
      return { buffer, filename: body.filename ?? 'upload' };
    }

    throw new BadRequestException(
      'Provide a file via multipart/form-data (field: "file") or a JSON body with "base64" string.',
    );
  }
}
