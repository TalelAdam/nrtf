"use client";

import { useState } from 'react';
import { Send } from 'lucide-react';
import { useSubmitExtraction, type ExtractionResult, type SubmissionResponse } from '@/hooks/use-extraction';

interface SubmissionButtonProps {
  result: ExtractionResult;
}

function F1Display({ response }: { response: SubmissionResponse }) {
  const f1Color = response.f1Score >= 0.8 ? '#10b981' : response.f1Score >= 0.6 ? '#f59e0b' : '#ef4444';
  return (
    <div className="submission-result">
      <div className="f1-score" style={{ color: f1Color }}>
        F1 {(response.f1Score * 100).toFixed(1)}%
      </div>
      <div className="f1-breakdown">
        <span>P: {(response.precision * 100).toFixed(1)}%</span>
        <span>R: {(response.recall * 100).toFixed(1)}%</span>
      </div>
      <p className="f1-message">{response.message}</p>
    </div>
  );
}

export function SubmissionButton({ result }: SubmissionButtonProps) {
  const { mutate, isPending, error, data } = useSubmitExtraction();
  const [submitted, setSubmitted] = useState(false);

  if (data) return <F1Display response={data} />;

  return (
    <div className="submission-section">
      {error && <p className="submission-error">{error.message}</p>}
      <button
        className="submission-btn"
        disabled={isPending || submitted}
        onClick={() => {
          setSubmitted(true);
          mutate(result);
        }}
      >
        <Send size={16} />
        {isPending ? 'Submitting…' : 'Submit to Platform'}
      </button>
    </div>
  );
}
