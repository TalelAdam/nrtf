"use client";

import { AlertTriangle } from 'lucide-react';
import type { ExtractionResult } from '@/hooks/use-extraction';

interface ValidationPanelProps {
  result: ExtractionResult;
}

export function ValidationPanel({ result }: ValidationPanelProps) {
  const warnings = result.warnings ?? [];
  if (!warnings.length) {
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
        <span>{warnings.length} validation warning{warnings.length !== 1 ? 's' : ''}</span>
      </div>
      <ul className="validation-list">
        {warnings.map((w, i) => (
          <li key={i} className="validation-item">{w}</li>
        ))}
      </ul>
    </div>
  );
}
