"use client";

import { CheckCircle, Circle, Loader2 } from 'lucide-react';

export type StageStatus = 'pending' | 'active' | 'done' | 'error';

export interface PipelineStage {
  id: string;
  label: string;
  detail?: string;
  status: StageStatus;
  confidence?: number;
}

interface ExtractionProgressProps {
  stages: PipelineStage[];
}

const DEFAULT_STAGES: PipelineStage[] = [
  { id: 'detect', label: 'File Detection', status: 'pending' },
  { id: 'ocr', label: 'OCR', status: 'pending' },
  { id: 'llm', label: 'LLM Extraction', status: 'pending' },
  { id: 'validate', label: 'Validation', status: 'pending' },
  { id: 'done', label: 'Done', status: 'pending' },
];

function StageIcon({ status }: { status: StageStatus }) {
  if (status === 'active') return <Loader2 size={18} className="stage-icon stage-icon--spin" />;
  if (status === 'done') return <CheckCircle size={18} className="stage-icon stage-icon--done" />;
  return <Circle size={18} className="stage-icon stage-icon--pending" />;
}

export function ExtractionProgress({ stages }: ExtractionProgressProps) {
  const stageList = stages.length ? stages : DEFAULT_STAGES;

  return (
    <div className="pipeline-stages">
      {stageList.map((stage, i) => (
        <div key={stage.id} className={`pipeline-stage pipeline-stage--${stage.status}`}>
          <StageIcon status={stage.status} />
          <div className="stage-body">
            <span className="stage-label">{stage.label}</span>
            {stage.detail && <span className="stage-detail">{stage.detail}</span>}
            {stage.confidence !== undefined && (
              <div className="stage-conf-bar">
                <div
                  className="stage-conf-fill"
                  style={{ width: `${Math.round(stage.confidence * 100)}%` }}
                />
                <span>{(stage.confidence * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
          {i < stageList.length - 1 && <div className="stage-connector" />}
        </div>
      ))}
    </div>
  );
}

/** Build stages from an extraction result's quality score for a quick visual. */
export function buildStagesFromResult(
  status: 'ok' | 'partial' | 'error',
  qualityScore: number,
): PipelineStage[] {
  const done = status !== 'error';
  return [
    { id: 'detect', label: 'File Detection', status: 'done', confidence: 1.0 },
    { id: 'ocr', label: 'OCR', status: done ? 'done' : 'error', confidence: done ? 0.92 : undefined },
    { id: 'llm', label: 'LLM Extraction', status: done ? 'done' : 'error', confidence: done ? qualityScore : undefined },
    { id: 'validate', label: 'Validation', status: done ? 'done' : 'error', confidence: done ? qualityScore : undefined },
    { id: 'done', label: 'Done', status: status === 'ok' ? 'done' : status === 'partial' ? 'active' : 'error' },
  ];
}
