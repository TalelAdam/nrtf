import {
  Controller,
  Post,
  Body,
  Req,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { DocExtractionService } from './doc-extraction.service';
import { SubmitPayloadDto } from './dto/extract-document.dto';
import { ExtractionResultDto, SubmissionResultDto } from './dto/extraction-result.dto';

/**
 * DocumentExtraction controller — Part 2 endpoints.
 *
 * All file endpoints accept:
 *   - multipart/form-data  (field name: "file")
 *   - application/json    with { "base64": "<base64string>", "filename": "..." }
 */
@ApiTags('doc-extraction')
@Controller('extract')
export class DocExtractionController {
  private readonly logger = new Logger(DocExtractionController.name);

  constructor(private readonly docExtraction: DocExtractionService) {}

  // ── Generic auto-routing ───────────────────────────────────────────────────

  @Post('document')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Auto-detect document type and extract (bill | excel | audit)' })
  @ApiResponse({ status: 200, type: ExtractionResultDto })
  @ApiBody({
    schema: {
      oneOf: [
        { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
        { type: 'object', properties: { base64: { type: 'string' }, filename: { type: 'string' } } },
      ],
    },
  })
  async extractDocument(@Req() req: FastifyRequest): Promise<ExtractionResultDto> {
    const { buffer, filename } = await this.resolveFile(req);
    return this.docExtraction.extractDocument(buffer, filename);
  }

  // ── Type-specific endpoints ────────────────────────────────────────────────

  @Post('bill')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Extract a utility bill (STEG / SONEDE / STG)' })
  @ApiResponse({ status: 200, type: ExtractionResultDto })
  async extractBill(@Req() req: FastifyRequest): Promise<ExtractionResultDto> {
    const { buffer, filename } = await this.resolveFile(req);
    return this.docExtraction.extractBill(buffer, filename);
  }

  @Post('audit')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Extract an industrial energy audit report' })
  @ApiResponse({ status: 200, type: ExtractionResultDto })
  async extractAudit(@Req() req: FastifyRequest): Promise<ExtractionResultDto> {
    const { buffer, filename } = await this.resolveFile(req);
    return this.docExtraction.extractAudit(buffer, filename);
  }

  // ── Submission ─────────────────────────────────────────────────────────────

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit extracted data to the challenge platform, receive F1 score' })
  @ApiResponse({ status: 200, type: SubmissionResultDto })
  async submit(@Body() dto: SubmitPayloadDto): Promise<SubmissionResultDto> {
    return this.docExtraction.submitToChallenge(dto.type, dto.data);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Normalises multipart file upload OR base64 JSON body into a {buffer, filename} pair.
   * Supports Fastify multipart (registered in main.ts via @fastify/multipart).
   */
  private async resolveFile(
    req: FastifyRequest,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const contentType = req.headers['content-type'] ?? '';

    if (contentType.includes('multipart/form-data')) {
      const data = await (req as FastifyRequest & { file(): Promise<{ toBuffer(): Promise<Buffer>; filename: string }> }).file();
      if (!data) throw new BadRequestException('No file field in multipart body');
      const buffer = await data.toBuffer();
      return { buffer, filename: data.filename ?? 'upload' };
    }

    // JSON body with base64
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
