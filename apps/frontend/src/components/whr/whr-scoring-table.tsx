"use client";

import { useWhrResult, ScoreBreakdown } from '@/hooks/use-whr';

const CRITERION_LABELS: Record<string, string> = {
  C1: 'Energy (×0.30)',
  C2: 'CO₂ (×0.20)',
  C3: 'Feasibility (×0.20)',
  C4: 'CAPEX (×0.15)',
  C5: 'ROI (×0.15)',
};

function bar(v: number) {
  return (
    <div className="score-bar-wrap">
      <div className="score-bar-fill" style={{ width: `${v * 10}%` }} />
      <span className="score-bar-label">{v.toFixed(1)}</span>
    </div>
  );
}

function ScoreRow({ src, breakdown }: { src: string; breakdown: ScoreBreakdown }) {
  const isTop = src === 'W3';
  return (
    <tr className={isTop ? 'scoring-row scoring-row--top' : 'scoring-row'}>
      <td className="scoring-src">{src}</td>
      {(['C1', 'C2', 'C3', 'C4', 'C5'] as const).map((c) => (
        <td key={c}>{bar(breakdown[c])}</td>
      ))}
      <td className="scoring-total">{breakdown.total.toFixed(2)}</td>
    </tr>
  );
}

export function WhrScoringTable() {
  const { data, isLoading, isError } = useWhrResult();

  if (isLoading) return <div className="scoring-placeholder">Computing scores…</div>;
  if (isError || !data) return <div className="scoring-placeholder">Scores unavailable</div>;

  return (
    <div className="scoring-table-wrap">
      <h3 className="scoring-title">MCDA Scoring Matrix</h3>
      <table className="scoring-table">
        <thead>
          <tr>
            <th>Source</th>
            {Object.values(CRITERION_LABELS).map((l) => <th key={l}>{l}</th>)}
            <th>Composite</th>
          </tr>
        </thead>
        <tbody>
          {(['W1', 'W2', 'W3'] as const).map((src) => (
            <ScoreRow key={src} src={src} breakdown={data.scores[src]} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
