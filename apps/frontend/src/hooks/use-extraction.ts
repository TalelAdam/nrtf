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
}

export interface SubmissionResponse {
  submissionId: string;
  f1Score: number;
  precision: number;
  recall: number;
  message: string;
}

export type ExtractionMode = 'ocr' | 'llm';

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

      return res.json() as Promise<ExtractionResult>;
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
      const res = await fetch('/api/extract/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: result.records, fileName: result.fileName }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Submission failed (${res.status}): ${msg}`);
      }

      return res.json() as Promise<SubmissionResponse>;
    },
  });
}
