"use client";

import { useMutation, useQuery } from '@tanstack/react-query';

export interface ExtractionRecord {
  field: string;
  value: string | number | null;
  unit?: string;
  confidence: number;
  source: { page?: number; bbox?: number[]; engine?: string };
}

export interface ExtractionResult {
  id: string;
  fileName: string;
  fileType: string;
  status: 'ok' | 'partial' | 'error';
  qualityScore: number;
  records: ExtractionRecord[];
  warnings: string[];
  submissionId?: string;
  /** Raw backend payload preserved for submission */
  _raw?: BackendExtractionResult;
}

export interface SubmissionResponse {
  submissionId: string;
  f1Score: number;
  precision: number;
  recall: number;
  message: string;
}

export type ExtractionMode = 'ocr' | 'llm';

// ─── Backend DTO shape (matches ExtractionResultDto) ──────────────
interface BackendValidation {
  valid: boolean;
  fieldCount: number;
  nullFields: string[];
  errors: string[];
  consistencyWarnings: string[];
  qualityScore: number;
}

export interface BackendExtractionResult {
  kind: string;
  sha: string;
  success: boolean;
  data: Record<string, unknown> | null;
  validation: BackendValidation;
  qualityScore: number;
  ocrConfidence?: number;
  processingTimeMs: number;
  fromCache: boolean;
  error?: string;
}

// Known energy unit tokens (longest-match friendly, case-sensitive)
const ENERGY_UNIT_TOKENS = [
  'GWh','MWh','kWh','Wh',
  'MMBtu','GJ','MJ','kJ',
  'Gcal','Mcal','kcal',
  'Mth','th',
  'toe','tep',
  'Nm3_NG','m3_NG','Nm3','m3',
  'ton_steam',
];

/**
 * Try to split a raw string value like "45 000 kWh" or "1,2 Gcal" into
 * { value: number, unit: string }. Returns null if no unit recognised.
 */
function tryParseValueUnit(raw: unknown): { value: number; unit: string } | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/\s/g, '');
  // Match: optional sign + digits/comma/dot + known unit
  for (const unit of ENERGY_UNIT_TOKENS) {
    const re = new RegExp(`^([+-]?[\\d,.]+)${unit.replace('3', '³?3?')}$`, 'i');
    const m = cleaned.match(re);
    if (m) {
      const num = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(num)) return { value: num, unit };
    }
  }
  return null;
}

/** Flatten a backend data object into ExtractionRecord rows */
function flattenData(
  data: Record<string, unknown> | null,
  kind: string,
  ocrConf?: number,
): ExtractionRecord[] {
  if (!data) return [];

  const defaultConf = ocrConf !== undefined ? ocrConf / 100 : 0.8;
  const engine = kind.includes('scanned') ? 'tesseract' : kind === 'excel' ? 'xlsx' : 'llm';

  function toRecord(field: string, raw: unknown): ExtractionRecord {
    if (raw === null || raw === undefined) {
      return { field, value: null, confidence: defaultConf, source: { engine } };
    }
    // Try to extract numeric value + unit from strings like "45 000 kWh"
    const parsed = tryParseValueUnit(raw);
    if (parsed) {
      return { field, value: parsed.value, unit: parsed.unit, confidence: defaultConf, source: { engine } };
    }
    // numeric already
    if (typeof raw === 'number') {
      return { field, value: raw, confidence: defaultConf, source: { engine } };
    }
    const coerced = typeof raw === 'object' ? JSON.stringify(raw) : raw as string;
    return { field, value: coerced, confidence: defaultConf, source: { engine } };
  }

  // Excel: entries array → one row per entry × field
  if (kind === 'excel' && Array.isArray((data as { entries?: unknown[] }).entries)) {
    const entries = (data as { entries: Record<string, unknown>[] }).entries;
    const records: ExtractionRecord[] = [];
    entries.forEach((entry, idx) => {
      Object.entries(entry).forEach(([field, value]) => {
        if (field === 'source') return;
        records.push(toRecord(`[${idx + 1}] ${field}`, value));
      });
    });
    return records;
  }

  // Bill / Audit: flat key-value
  return Object.entries(data)
    .filter(([k]) => k !== 'field_sources')
    .map(([field, value]) => toRecord(field, value));
}

/** Map the backend ExtractionResultDto to the frontend ExtractionResult */
function mapBackendResult(raw: BackendExtractionResult, fileName: string): ExtractionResult {
  const status = raw.success ? 'ok' : raw.data !== null ? 'partial' : 'error';
  const records = flattenData(raw.data, raw.kind, raw.ocrConfidence);
  const warnings = [
    ...(raw.validation?.consistencyWarnings ?? []),
    ...(raw.validation?.errors ?? []),
    ...(raw.error ? [raw.error] : []),
  ];
  return {
    id: raw.sha || crypto.randomUUID(),
    fileName,
    fileType: raw.kind,
    status,
    qualityScore: raw.qualityScore ?? raw.validation?.qualityScore ?? 0,
    records,
    warnings,
    _raw: raw,
  };
}

// ─ POST /api/extract/document ─────────────────────────────────────
export function useUploadDocument() {
  return useMutation<ExtractionResult, Error, { file: File; mode: ExtractionMode }>({
    mutationFn: async ({ file, mode }) => {
      const form = new FormData();
      form.append('file', file);
      form.append('mode', mode);

      const res = await fetch('/api/extract/document', {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Extraction failed (${res.status}): ${msg}`);
      }

      const raw = await res.json() as BackendExtractionResult;
      return mapBackendResult(raw, file.name);
    },
  });
}

// ─ GET /api/extract/status/:id ────────────────────────────────────
export function useExtractionStatus(extractionId: string | null) {
  return useQuery({
    queryKey: ['extraction', 'status', extractionId],
    queryFn: async () => {
      const res = await fetch(`/api/extract/status/${extractionId}`);
      if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
      return res.json() as Promise<ExtractionResult>;
    },
    enabled: Boolean(extractionId),
    refetchInterval: 3000,
    staleTime: 0,
  });
}

// ─ POST /api/extract/submit ───────────────────────────────────────
export function useSubmitExtraction() {
  return useMutation<SubmissionResponse, Error, ExtractionResult>({
    mutationFn: async (result: ExtractionResult) => {
      const raw = result._raw;
      const payload = raw
        ? { type: raw.kind.includes('excel') ? 'excel' : raw.kind.includes('audit') ? 'audit' : 'bill', data: raw.data }
        : { type: 'bill', data: {} };

      const res = await fetch('/api/extract/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Submission failed (${res.status}): ${msg}`);
      }

      const body = await res.json() as { f1?: number; httpStatus: number; accepted: boolean; error?: string; details?: unknown };
      return {
        submissionId: crypto.randomUUID(),
        f1Score: body.f1 ?? 0,
        precision: 0,
        recall: 0,
        message: body.error ?? (body.accepted ? 'Submission accepted' : `HTTP ${body.httpStatus}`),
      };
    },
  });
}
