import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnergyBill } from '../validation/schemas/bill.schema';
import type { ExcelExtractionResult } from '../validation/schemas/excel-entry.schema';
import type { AuditFlowSummary } from '../validation/schemas/audit.schema';

export type SubmittablePayload =
  | { type: 'bill'; data: EnergyBill }
  | { type: 'excel'; data: ExcelExtractionResult }
  | { type: 'audit'; data: AuditFlowSummary };

export interface SubmissionResponse {
  /** F1 score returned by the platform (0-1) */
  f1?: number;
  /** Raw score details from the platform */
  details?: unknown;
  /** HTTP status code from the challenge endpoint */
  httpStatus: number;
  /** Whether the submission was accepted */
  accepted: boolean;
  /** Platform-level error message if any */
  error?: string;
}

/**
 * Submits extracted data to the official Re·Tech Fusion challenge platform.
 *
 * The submission endpoint is announced at the start of each part.
 * Configure via env vars:
 *   SUBMISSION_BASE_URL — e.g. https://platform.retechfusion.tn
 *   SUBMISSION_API_KEY  — team API key (if required)
 *   SUBMISSION_TEAM_ID  — team identifier (if required)
 */
@Injectable()
export class SubmissionService {
  private readonly logger = new Logger(SubmissionService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly teamId: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>(
      'SUBMISSION_BASE_URL',
      'http://localhost:9000', // fallback local mock
    );
    this.apiKey = this.config.get<string>('SUBMISSION_API_KEY');
    this.teamId = this.config.get<string>('SUBMISSION_TEAM_ID');
  }

  async submit(payload: SubmittablePayload): Promise<SubmissionResponse> {
    const endpoint = `${this.baseUrl}/api/submit/${payload.type}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['X-Api-Key'] = this.apiKey;
    if (this.teamId) headers['X-Team-Id'] = this.teamId;

    this.logger.log(`Submitting ${payload.type} to ${endpoint}`);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          team_id: this.teamId,
          payload: payload.data,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(30_000),
      });

      const httpStatus = response.status;
      const body = await response.json().catch(() => ({})) as Record<string, unknown>;

      if (!response.ok) {
        this.logger.warn(`Submission rejected: HTTP ${httpStatus} — ${JSON.stringify(body)}`);
        return {
          httpStatus,
          accepted: false,
          error: (body['error'] as string) ?? `HTTP ${httpStatus}`,
          details: body,
        };
      }

      const f1 = typeof body['f1'] === 'number' ? body['f1'] : undefined;
      this.logger.log(`Submission accepted: F1=${f1?.toFixed(4) ?? 'n/a'}`);
      return { httpStatus, accepted: true, f1, details: body };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Submission network error: ${message}`);
      return { httpStatus: 0, accepted: false, error: message };
    }
  }

  /**
   * Dry-run: validate the payload shape without actually submitting.
   * Useful during development when the platform endpoint is not yet available.
   */
  dryRun(payload: SubmittablePayload): { valid: boolean; fieldCount: number } {
    const data = payload.data as Record<string, unknown>;
    const nonNullFields = Object.values(data).filter((v) => v !== null && v !== undefined).length;
    return { valid: nonNullFields > 0, fieldCount: nonNullFields };
  }
}
