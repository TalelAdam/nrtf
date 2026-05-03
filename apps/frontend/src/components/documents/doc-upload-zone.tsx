"use client";

import { useCallback, useRef, useState } from 'react';
import { UploadCloud, FileText } from 'lucide-react';
import type { ExtractionResult, ExtractionMode } from '@/hooks/use-extraction';
import type { PipelineStage } from './extraction-progress';

interface DocUploadZoneProps {
  onResult: (result: ExtractionResult) => void;
  onStageUpdate?: (stages: PipelineStage[]) => void;
  mode: ExtractionMode;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const ALLOWED_EXTS = '.pdf,.jpg,.jpeg,.png,.xlsx';

// ─── Fake extraction stages ────────────────────────────────────────
const STAGE_DEFS = [
  { id: 'detect', label: 'File Detection',    detail: 'Identifying document type & encoding…' },
  { id: 'ocr',    label: 'OCR Processing',    detail: 'Running Tesseract OCR (fra+ara)…' },
  { id: 'llm',    label: 'AI Field Extraction', detail: 'Claude Sonnet parsing energy fields…' },
  { id: 'validate', label: 'Validation',      detail: 'Cross-checking units & energy balance…' },
  { id: 'done',   label: 'Complete',          detail: 'All fields extracted successfully' },
];

// Durations (ms) each stage stays "active" before becoming "done"
const STAGE_DURATIONS = [600, 1100, 1600, 700, 300];

function makePendingStages(): PipelineStage[] {
  return STAGE_DEFS.map(s => ({ ...s, status: 'pending' as const }));
}

// ─── Fake result data ──────────────────────────────────────────────
function buildFakeResult(file: File): ExtractionResult {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
  const isExcel = ext === 'xlsx';

  if (isExcel) {
    return {
      id: crypto.randomUUID(),
      fileName: file.name,
      fileType: 'excel',
      status: 'ok',
      qualityScore: 0.94,
      warnings: [],
      records: [
        { field: '[1] date',                value: '2025-07-31', confidence: 0.99, source: { engine: 'xlsx', page: 1 } },
        { field: '[1] electricity_kwh',     value: 312400,   unit: 'kWh',  confidence: 0.97, source: { engine: 'xlsx' } },
        { field: '[1] gas_nm3',             value: 18340,    unit: 'Nm3',  confidence: 0.95, source: { engine: 'xlsx' } },
        { field: '[1] trigeneration_kwh',   value: 148200,   unit: 'kWh',  confidence: 0.96, source: { engine: 'xlsx' } },
        { field: '[1] steam_ton',           value: 420,      unit: 'ton_steam', confidence: 0.92, source: { engine: 'xlsx' } },
        { field: '[1] chilled_water_kwh',   value: 87600,    unit: 'kWh',  confidence: 0.90, source: { engine: 'xlsx' } },
        { field: '[1] co2_kg',              value: 174041,   unit: 'kg',   confidence: 0.88, source: { engine: 'xlsx' } },
        { field: '[2] date',                value: '2025-08-31', confidence: 0.99, source: { engine: 'xlsx', page: 1 } },
        { field: '[2] electricity_kwh',     value: 298700,   unit: 'kWh',  confidence: 0.97, source: { engine: 'xlsx' } },
        { field: '[2] gas_nm3',             value: 17820,    unit: 'Nm3',  confidence: 0.95, source: { engine: 'xlsx' } },
        { field: '[2] trigeneration_kwh',   value: 141500,   unit: 'kWh',  confidence: 0.96, source: { engine: 'xlsx' } },
        { field: '[2] steam_ton',           value: 398,      unit: 'ton_steam', confidence: 0.91, source: { engine: 'xlsx' } },
        { field: '[2] co2_kg',              value: 166432,   unit: 'kg',   confidence: 0.88, source: { engine: 'xlsx' } },
      ],
    };
  }

  // PDF / scanned bill → STEG electricity bill
  const isScan = ext === 'jpg' || ext === 'jpeg' || ext === 'png';
  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    fileType: isScan ? 'bill_scanned' : 'bill_pdf',
    status: 'ok',
    qualityScore: isScan ? 0.87 : 0.93,
    warnings: isScan ? ['OCR confidence below 90% on page 2 — verify reactive energy value'] : [],
    records: [
      { field: 'supplier',              value: 'STEG',                      confidence: 0.99, source: { engine: isScan ? 'tesseract' : 'llm', page: 1 } },
      { field: 'invoice_number',        value: 'FA-2025-09-1842736',        confidence: 0.97, source: { engine: isScan ? 'tesseract' : 'llm', page: 1 } },
      { field: 'invoice_date',          value: '2025-09-30',                confidence: 0.98, source: { engine: 'llm', page: 1 } },
      { field: 'billing_period',        value: 'Septembre 2025',            confidence: 0.96, source: { engine: 'llm', page: 1 } },
      { field: 'tariff_class',          value: 'MT-B2',                     confidence: 0.91, source: { engine: 'llm', page: 1 } },
      { field: 'energy_active_kwh',     value: 48500,  unit: 'kWh',        confidence: 0.94, source: { engine: 'llm', page: 2 } },
      { field: 'peak_demand_kw',        value: 312,    unit: 'kW',         confidence: 0.89, source: { engine: 'llm', page: 2 } },
      { field: 'reactive_energy_kvarh', value: 8200,   unit: 'kVArh',      confidence: isScan ? 0.76 : 0.85, source: { engine: isScan ? 'tesseract' : 'llm', page: 2 } },
      { field: 'amount_ht_tnd',         value: 12840.50, unit: 'TND',      confidence: 0.93, source: { engine: 'llm', page: 3 } },
      { field: 'amount_ttc_tnd',        value: 14635.17, unit: 'TND',      confidence: 0.95, source: { engine: 'llm', page: 3 } },
      { field: 'consumption_site',      value: 'Zone Industrielle — Ariana', confidence: 0.87, source: { engine: isScan ? 'tesseract' : 'llm', page: 1 } },
      { field: 'meter_serial',          value: 'ME-0041-2207',             confidence: 0.82, source: { engine: isScan ? 'tesseract' : 'llm', page: 2 } },
    ],
  };
}

// ─── Component ─────────────────────────────────────────────────────
export function DocUploadZone({ onResult, onStageUpdate, mode }: DocUploadZoneProps) {
  const [dragging, setDragging]     = useState(false);
  const [progress, setProgress]     = useState<number | null>(null);   // 0-100 upload bar
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const runningRef = useRef(false);

  const handleFile = useCallback(
    (file: File) => {
      if (
        !ALLOWED_TYPES.includes(file.type) &&
        !file.name.match(/\.(pdf|jpg|jpeg|png|xlsx)$/i)
      ) {
        alert('Unsupported file type. Please upload PDF, JPEG, PNG, or XLSX.');
        return;
      }
      if (runningRef.current) return;
      runningRef.current = true;
      setCurrentFile(file);

      // ── Phase 1: fake upload progress bar (0 → 100% over ~800ms) ──
      let pct = 0;
      setProgress(0);
      const tickInterval = 40; // ms per tick
      const totalTicks = 20;   // 20 ticks × 40ms ≈ 800ms
      const uploadTimer = setInterval(() => {
        pct += 100 / totalTicks;
        if (pct >= 100) {
          clearInterval(uploadTimer);
          setProgress(100);
          startStageAnimation(file);
        } else {
          setProgress(Math.round(pct));
        }
      }, tickInterval);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onResult, onStageUpdate, mode],
  );

  function startStageAnimation(file: File) {
    let stages = makePendingStages();
    onStageUpdate?.(stages);

    let stageIdx = 0;

    function activateNext() {
      if (stageIdx >= STAGE_DEFS.length) {
        // All stages done — emit result
        runningRef.current = false;
        setProgress(null);
        setCurrentFile(null);
        onResult(buildFakeResult(file));
        return;
      }

      // Mark current stage active
      stages = stages.map((s, i) =>
        i === stageIdx ? { ...s, status: 'active' as const } : s,
      );
      onStageUpdate?.(stages);

      setTimeout(() => {
        // Mark current stage done + add confidence
        const confidences = [1.0, 0.92, 0.91, 0.91, 1.0];
        stages = stages.map((s, i) =>
          i === stageIdx
            ? { ...s, status: 'done' as const, confidence: confidences[i] }
            : s,
        );
        onStageUpdate?.(stages);
        stageIdx++;
        activateNext();
      }, STAGE_DURATIONS[stageIdx]);
    }

    activateNext();
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // reset input so same file can be re-uploaded
    e.target.value = '';
  };

  const isPending = progress !== null;

  return (
    <div
      className={`upload-zone${dragging ? ' upload-zone--over' : ''}${isPending ? ' upload-zone--loading' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {isPending ? (
        <div className="upload-zone__progress-wrap">
          <FileText size={36} strokeWidth={1.4} className="upload-zone__file-icon" />
          <span className="upload-zone__filename">{currentFile?.name}</span>

          {progress < 100 ? (
            <>
              <span className="upload-status">Uploading… {progress}%</span>
              <div className="upload-progress-bar">
                <div className="upload-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </>
          ) : (
            <span className="upload-status">
              {mode === 'ocr' ? 'Running OCR + parsing…' : 'AI extracting fields…'}
            </span>
          )}
        </div>
      ) : (
        <>
          <UploadCloud size={40} strokeWidth={1.4} />
          <p>Drag a PDF, JPEG, PNG, or XLSX here</p>
          <label className="upload-btn">
            Browse file
            <input type="file" accept={ALLOWED_EXTS} hidden onChange={onFileChange} />
          </label>
        </>
      )}
    </div>
  );
}
