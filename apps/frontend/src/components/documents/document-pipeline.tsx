"use client";

import { useState } from 'react';
import { ScanSearch, BrainCircuit } from 'lucide-react';
import { DocUploadZone } from './doc-upload-zone';
import { ExtractionProgress, buildStagesFromResult } from './extraction-progress';
import { ExtractionResults } from './extraction-results';
import { ValidationPanel } from './validation-panel';
import { SubmissionButton } from './submission-button';
import type { ExtractionResult } from '@/hooks/use-extraction';
import type { ExtractionMode } from '@/hooks/use-extraction';

export function DocumentPipeline() {
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [mode, setMode] = useState<ExtractionMode>('ocr');

  return (
    <div className="doc-pipeline">
      <div className="doc-pipeline__upload">
        <h2 className="doc-pipeline__title">Document Extraction Pipeline</h2>
        <p className="doc-pipeline__subtitle">
          Upload a bill (PDF/JPEG), Excel report, or audit document.
          Choose extraction mode, then upload.
        </p>

        <div className="mode-toggle">
          <button
            className={`mode-toggle__btn${mode === 'ocr' ? ' mode-toggle__btn--active' : ''}`}
            onClick={() => setMode('ocr')}
          >
            <ScanSearch size={18} />
            <div>
              <strong>OCR + PDF Parsing</strong>
              <span>Tesseract OCR → pdfplumber → structured extraction</span>
            </div>
          </button>
          <button
            className={`mode-toggle__btn${mode === 'llm' ? ' mode-toggle__btn--active' : ''}`}
            onClick={() => setMode('llm')}
          >
            <BrainCircuit size={18} />
            <div>
              <strong>LLM Extraction</strong>
              <span>Send document directly to AI for field extraction</span>
            </div>
          </button>
        </div>

        <DocUploadZone onResult={setResult} mode={mode} />
      </div>

      {result && (
        <>
          <ExtractionProgress
            stages={buildStagesFromResult(result.status, result.qualityScore)}
          />
          <ExtractionResults result={result} />
          <ValidationPanel result={result} />
          <SubmissionButton result={result} />
        </>
      )}
    </div>
  );
}
