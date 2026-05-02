"use client";

import type { ExtractionResult, ExtractionRecord } from '@/hooks/use-extraction';

function QualityBadge({ score }: { score: number }) {
  const color = score >= 0.85 ? '#10b981' : score >= 0.65 ? '#f59e0b' : '#ef4444';
  const label = score >= 0.85 ? 'High' : score >= 0.65 ? 'Medium' : 'Low';
  return (
    <span className="quality-badge" style={{ background: color + '30', color }}>
      {label} {(score * 100).toFixed(0)}%
    </span>
  );
}

function ConfBar({ v }: { v: number }) {
  return (
    <div className="conf-bar-wrap">
      <div className="conf-bar-fill" style={{ width: `${Math.round(v * 100)}%` }} />
      <span>{(v * 100).toFixed(0)}%</span>
    </div>
  );
}

function RecordRow({ r }: { r: ExtractionRecord }) {
  return (
    <tr className="result-row">
      <td className="result-field">{r.field}</td>
      <td className="result-value">
        {r.value === null ? <em className="result-null">—</em> : String(r.value)}
        {r.unit && <span className="result-unit"> {r.unit}</span>}
      </td>
      <td><ConfBar v={r.confidence} /></td>
      <td className="result-source">
        {r.source.engine ?? 'llm'}
        {r.source.page !== undefined && ` p.${r.source.page}`}
      </td>
    </tr>
  );
}

interface ExtractionResultsProps {
  result: ExtractionResult;
}

export function ExtractionResults({ result }: ExtractionResultsProps) {
  return (
    <div className="extraction-results">
      <div className="results-header">
        <h3>{result.fileName}</h3>
        <QualityBadge score={result.qualityScore} />
        <span className="results-count">{result.records.length} fields extracted</span>
      </div>

      <table className="results-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Value</th>
            <th>Confidence</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {result.records.map((r, i) => (
            <RecordRow key={`${r.field}-${i}`} r={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
