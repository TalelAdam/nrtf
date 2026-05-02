"use client";

import { AlertTriangle } from 'lucide-react';
import type { ExtractionResult } from '@/hooks/use-extraction';

interface ValidationPanelProps {
  result: ExtractionResult;
}

export function ValidationPanel({ result }: ValidationPanelProps) {
  if (!result.warnings.length) {
    return (
      <div className="validation-panel validation-panel--ok">
        <span>All field consistency checks passed.</span>
      </div>
    );
  }

  return (
    <div className="validation-panel validation-panel--warn">
      <div className="validation-header">
        <AlertTriangle size={18} />
        <span>{result.warnings.length} validation warning{result.warnings.length !== 1 ? 's' : ''}</span>
      </div>
      <ul className="validation-list">
        {result.warnings.map((w, i) => (
          <li key={i} className="validation-item">{w}</li>
        ))}
      </ul>
    </div>
  );
}
