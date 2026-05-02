"use client";

import { useWhrScenarios, WHRScenario } from '@/hooks/use-whr';

const COLORS: Record<string, string> = {
  S1: '#f59e0b',
  S2: '#10b981',
  S3: '#00d4ff',
};

function ScenarioCard({ scenario }: { scenario: WHRScenario }) {
  const color = COLORS[scenario.id] ?? '#ffffff';
  const roiOk = isFinite(scenario.roi_yr) && scenario.roi_yr < 10;
  return (
    <div className="scenario-card" style={{ borderColor: color }}>
      <div className="scenario-card__header">
        <span className="scenario-card__badge" style={{ background: color }}>{scenario.id}</span>
        <h3>{scenario.name}</h3>
      </div>
      <p className="scenario-card__desc">{scenario.description}</p>
      <div className="scenario-card__grid">
        <div>
          <span>Energy</span>
          <strong>{scenario.E_mwh.toFixed(0)} MWh/yr</strong>
        </div>
        <div>
          <span>CO₂ avoided</span>
          <strong>{scenario.co2_t.toFixed(0)} tCO₂</strong>
        </div>
        <div>
          <span>Savings</span>
          <strong>{scenario.savings_dt.toLocaleString()} DT/yr</strong>
        </div>
        <div>
          <span>CAPEX</span>
          <strong>{scenario.capex_dt.toLocaleString()} DT</strong>
        </div>
        <div>
          <span>ROI</span>
          <strong style={{ color: roiOk ? '#10b981' : '#f59e0b' }}>
            {isFinite(scenario.roi_yr) ? `${scenario.roi_yr.toFixed(1)} yr` : '—'}
          </strong>
        </div>
        <div>
          <span>Score</span>
          <strong style={{ color }}>{scenario.score.total.toFixed(2)}/10</strong>
        </div>
      </div>
      <div className="scenario-card__eq">{scenario.equation}</div>
    </div>
  );
}

export function WhrScenarioCards() {
  const { data, isLoading, isError } = useWhrScenarios();

  if (isLoading) return <div className="scenario-cards--loading">Loading scenarios…</div>;
  if (isError || !data) return <div className="scenario-cards--error">Scenarios unavailable</div>;

  return (
    <div className="scenario-cards">
      {data.map((s) => <ScenarioCard key={s.id} scenario={s} />)}
    </div>
  );
}
