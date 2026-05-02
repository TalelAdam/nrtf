import { Injectable } from '@nestjs/common';
import type { ValidationReport } from '../validation/validation.service';
import type { PipelineResultDto } from './dto/comparison-result.dto';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface FieldAccuracy {
  /** Schema field name */
  field: string;
  /** Value produced by Pipeline A (null = not extracted) */
  valueA: unknown;
  /** Value produced by Pipeline B (null = not extracted) */
  valueB: unknown;
  /**
   * True when both pipelines agree within tolerance:
   *   - Numbers: absolute relative difference ≤ 5%
   *   - Strings: normalised (lowercase + collapsed whitespace) equality
   *   - null/undefined: two nulls agree; one null + one non-null does NOT agree
   */
  agree: boolean;
  /** Pipeline A confidence for this field (0-1) */
  confidenceA: number;
  /** Pipeline B confidence for this field (0-1) */
  confidenceB: number;
}

export interface AccuracyReport {
  /** Total fields evaluated (union of A and B key sets) */
  totalFields: number;
  /** Count of non-null fields from Pipeline A */
  extractedA: number;
  /** Count of non-null fields from Pipeline B */
  extractedB: number;
  /** extractedA / totalFields */
  extractionRateA: number;
  /** extractedB / totalFields */
  extractionRateB: number;
  /** Fields where A and B agree / totalFields */
  agreementRate: number;
  /** Pipeline with the higher qualityScore (or 'tie' if equal within 0.01) */
  winner: 'A' | 'B' | 'tie';
  /** Per-field breakdown */
  fieldBreakdown: FieldAccuracy[];
  /** Zod validation quality score from Pipeline A (0-1) */
  qualityScoreA: number;
  /** Zod validation quality score from Pipeline B (0-1) */
  qualityScoreB: number;
  /** Pipeline A end-to-end processing time in ms */
  processingMsA: number;
  /** Pipeline B end-to-end processing time in ms */
  processingMsB: number;
}

// ─── Numeric tolerance ────────────────────────────────────────────────────────

const NUMERIC_TOLERANCE = 0.05; // ±5%

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AccuracyService {
  /**
   * Compare two pipeline results and produce a field-level accuracy report.
   *
   * @param resultA       Structured output from Pipeline A (PipelineResultDto)
   * @param resultB       Structured output from Pipeline B (PipelineResultDto)
   * @param validationA   Zod + cross-field report for A
   * @param validationB   Zod + cross-field report for B
   */
  compare(
    resultA: PipelineResultDto,
    resultB: PipelineResultDto,
    validationA: ValidationReport,
    validationB: ValidationReport,
  ): AccuracyReport {
    // Collect the full union of field names from both pipelines
    const allFields = new Set<string>([
      ...Object.keys(resultA.extracted),
      ...Object.keys(resultB.extracted),
    ]);

    const fieldBreakdown: FieldAccuracy[] = [];

    for (const field of allFields) {
      const vA = resultA.extracted[field] ?? null;
      const vB = resultB.extracted[field] ?? null;
      const cA = resultA.confidence[field] ?? 0;
      const cB = resultB.confidence[field] ?? 0;

      fieldBreakdown.push({
        field,
        valueA: vA,
        valueB: vB,
        agree: this.valuesAgree(vA, vB),
        confidenceA: cA,
        confidenceB: cB,
      });
    }

    const totalFields = allFields.size;

    const extractedA = fieldBreakdown.filter((f) => f.valueA !== null && f.valueA !== undefined).length;
    const extractedB = fieldBreakdown.filter((f) => f.valueB !== null && f.valueB !== undefined).length;
    const agreeing = fieldBreakdown.filter((f) => f.agree).length;

    const qualityScoreA = validationA.qualityScore;
    const qualityScoreB = validationB.qualityScore;

    let winner: 'A' | 'B' | 'tie';
    const diff = qualityScoreA - qualityScoreB;
    if (Math.abs(diff) <= 0.01) {
      winner = 'tie';
    } else {
      winner = diff > 0 ? 'A' : 'B';
    }

    return {
      totalFields,
      extractedA,
      extractedB,
      extractionRateA: totalFields > 0 ? extractedA / totalFields : 0,
      extractionRateB: totalFields > 0 ? extractedB / totalFields : 0,
      agreementRate: totalFields > 0 ? agreeing / totalFields : 0,
      winner,
      fieldBreakdown,
      qualityScoreA,
      qualityScoreB,
      processingMsA: resultA.processingMs,
      processingMsB: resultB.processingMs,
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private valuesAgree(a: unknown, b: unknown): boolean {
    // Both absent → agree
    if (this.isAbsent(a) && this.isAbsent(b)) return true;
    // One absent, one present → disagree
    if (this.isAbsent(a) || this.isAbsent(b)) return false;

    // Numeric comparison with tolerance
    if (typeof a === 'number' && typeof b === 'number') {
      return this.numericAgrees(a, b);
    }

    // Coerce both to numbers if possible
    const nA = Number(a);
    const nB = Number(b);
    if (!Number.isNaN(nA) && !Number.isNaN(nB)) {
      return this.numericAgrees(nA, nB);
    }

    // String normalised comparison
    return this.normalise(String(a)) === this.normalise(String(b));
  }

  private isAbsent(v: unknown): boolean {
    return v === null || v === undefined;
  }

  private numericAgrees(a: number, b: number): boolean {
    if (a === 0 && b === 0) return true;
    const denominator = Math.max(Math.abs(a), Math.abs(b));
    return Math.abs(a - b) / denominator <= NUMERIC_TOLERANCE;
  }

  private normalise(s: string): string {
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
  }
}
