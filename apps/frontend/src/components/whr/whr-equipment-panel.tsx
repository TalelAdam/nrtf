"use client";

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useWhrEquipment, EquipmentItem, ScoreBreakdown } from '@/hooks/use-whr-equipment';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

// ── Colour palette per equipment ─────────────────────────────────
const EQ_COLORS: Record<string, string> = {
  EQ1: '#f59e0b', // amber  — boiler
  EQ2: '#10b981', // green  — compressor
};

// ─────────────────────────────────────────────────────────────────
// Equipment selector tabs (top strip)
// ─────────────────────────────────────────────────────────────────
function EquipmentSelector({
  items,
  selectedId,
  onSelect,
}: {
  items: EquipmentItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="eq-selector">
      {items.map((eq) => {
        const color = EQ_COLORS[eq.id] ?? '#94a3b8';
        const active = eq.id === selectedId;
        return (
          <button
            key={eq.id}
            className={`eq-selector-btn${active ? ' eq-selector-btn--active' : ''}`}
            style={{ borderColor: active ? color : 'transparent', color: active ? color : '#94a3b8' }}
            onClick={() => onSelect(eq.id)}
          >
            <span className="eq-selector-badge" style={{ background: color }}>{eq.id}</span>
            <div className="eq-selector-meta">
              <span className="eq-selector-name">{eq.name}</span>
              <span className="eq-selector-model">{eq.model}</span>
            </div>
            <span className="eq-selector-kw">{eq.rated_power_kw.toLocaleString()} kW</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Identity card (top left of detail view)
// ─────────────────────────────────────────────────────────────────
function IdentityCard({ eq }: { eq: EquipmentItem }) {
  const color = EQ_COLORS[eq.id] ?? '#94a3b8';
  return (
    <div className="eq-card eq-card--identity" style={{ borderTopColor: color }}>
      <div className="eq-card-header">
        <span className="eq-card-badge" style={{ background: color }}>{eq.id}</span>
        <h3 className="eq-card-title">{eq.name}</h3>
      </div>
      <table className="eq-identity-table">
        <tbody>
          <tr><td>Type</td><td>{eq.type}</td></tr>
          <tr><td>Manufacturer</td><td>{eq.manufacturer} — {eq.model}</td></tr>
          <tr><td>Location</td><td>{eq.location}</td></tr>
          <tr><td>Rated power</td><td>{eq.rated_power_kw.toLocaleString()} kW</td></tr>
          <tr><td>Annual hours</td><td>{eq.annual_hours.toLocaleString()} h/yr</td></tr>
          <tr><td>Load factor</td><td>{(eq.load_factor * 100).toFixed(0)} %</td></tr>
          <tr><td>Efficiency</td><td>{eq.efficiency_pct} %</td></tr>
          <tr><td>WHR method</td><td>{eq.whr_method}</td></tr>
          <tr><td>Equation</td><td><code>{eq.equation}</code></td></tr>
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Energy balance waterfall chart
// ─────────────────────────────────────────────────────────────────
function EnergyBalanceChart({ eq }: { eq: EquipmentItem }) {
  const eb = eq.energy_balance;
  const color = EQ_COLORS[eq.id] ?? '#94a3b8';

  return (
    <div className="eq-card eq-card--chart" style={{ borderTopColor: color }}>
      <h4 className="eq-card-subtitle">Energy Balance (MWh/yr)</h4>
      <p className="eq-card-note">{eb.energy_source} · {eb.unit_note}</p>
      <Plot
        data={[
          {
            type: 'funnel' as const,
            y: ['Input', 'Useful Output', 'Losses', 'Recoverable'],
            x: [eb.input_mwh, eb.useful_output_mwh, eb.loss_mwh, eb.recoverable_mwh],
            textinfo: 'value+percent initial',
            texttemplate: '%{x:,.0f} MWh<br>%{percentInitial}',
            marker: {
              color: [
                'rgba(99,102,241,0.8)',
                `${color}cc`,
                'rgba(239,68,68,0.7)',
                `${color}`,
              ],
            },
            connector: { line: { color: '#334155', width: 1 } },
          },
        ]}
        layout={{
          plot_bgcolor: 'transparent',
          paper_bgcolor: 'transparent',
          font: { color: '#94a3b8', size: 12 },
          margin: { l: 110, r: 20, t: 20, b: 20 },
          funnelmode: 'stack' as const,
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%', height: 220 }}
      />
      <div className="eq-energy-kpi-row">
        <div className="eq-energy-kpi">
          <span>Recoverable power</span>
          <strong style={{ color }}>{eb.recoverable_kw} kW</strong>
        </div>
        <div className="eq-energy-kpi">
          <span>Recoverable energy</span>
          <strong style={{ color }}>{eb.recoverable_mwh.toLocaleString()} MWh/yr</strong>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CO₂ profile card (gauge + breakdown)
// ─────────────────────────────────────────────────────────────────
function Co2Card({ eq }: { eq: EquipmentItem }) {
  const co2 = eq.co2;
  const color = EQ_COLORS[eq.id] ?? '#94a3b8';
  const remaining = co2.annual_t - co2.avoidable_t;

  return (
    <div className="eq-card eq-card--co2" style={{ borderTopColor: '#10b981' }}>
      <h4 className="eq-card-subtitle">CO₂ Emissions</h4>
      <div className="eq-co2-row">
        {/* Donut gauge */}
        <Plot
          data={[
            {
              type: 'pie' as const,
              values: [co2.avoidable_t, remaining],
              labels: ['Avoidable', 'Unavoidable'],
              hole: 0.62,
              marker: { colors: ['#10b981', '#1e293b'] },
              textinfo: 'none',
              hovertemplate: '%{label}: %{value} tCO₂<extra></extra>',
            },
          ]}
          layout={{
            plot_bgcolor: 'transparent',
            paper_bgcolor: 'transparent',
            showlegend: false,
            margin: { l: 10, r: 10, t: 10, b: 10 },
            annotations: [
              {
                text: `<b>${co2.avoidable_pct}%</b><br>avoidable`,
                x: 0.5, y: 0.5,
                font: { color: '#10b981', size: 13 },
                showarrow: false,
              },
            ],
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: 160, height: 160, flexShrink: 0 }}
        />
        {/* Text breakdown */}
        <div className="eq-co2-stats">
          <div className="eq-co2-stat">
            <span>Annual emissions</span>
            <strong>{co2.annual_t.toLocaleString()} tCO₂/yr</strong>
          </div>
          <div className="eq-co2-stat eq-co2-stat--avoidable">
            <span>Avoidable via WHR</span>
            <strong style={{ color: '#10b981' }}>{co2.avoidable_t.toLocaleString()} tCO₂/yr</strong>
          </div>
          <div className="eq-co2-stat">
            <span>Emission factor</span>
            <strong>{co2.factor_kg_kwh} kgCO₂/kWh</strong>
          </div>
          <div className="eq-co2-stat">
            <span>Scope</span>
            <strong>{co2.scope}</strong>
          </div>
          <div className="eq-co2-stat eq-co2-stat--source">
            <span>Source</span>
            <span>{co2.factor_source}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Economics card
// ─────────────────────────────────────────────────────────────────
function EconomicsCard({ eq }: { eq: EquipmentItem }) {
  const econ = eq.economics;
  const color = EQ_COLORS[eq.id] ?? '#94a3b8';
  const roiOk = isFinite(econ.roi_yr) && econ.roi_yr < 5;
  const YEARS = Array.from({ length: 13 }, (_, i) => i);

  return (
    <div className="eq-card eq-card--econ" style={{ borderTopColor: '#a78bfa' }}>
      <h4 className="eq-card-subtitle">Economics & ROI</h4>
      <div className="eq-econ-kpi-grid">
        <div className="eq-econ-kpi">
          <span>Annual savings</span>
          <strong style={{ color }}>{econ.annual_savings_dt.toLocaleString()} DT/yr</strong>
        </div>
        <div className="eq-econ-kpi">
          <span>CAPEX</span>
          <strong>{econ.capex_dt.toLocaleString()} DT</strong>
        </div>
        <div className="eq-econ-kpi">
          <span>Simple ROI</span>
          <strong style={{ color: roiOk ? '#10b981' : '#f59e0b' }}>
            {isFinite(econ.roi_yr) ? `${econ.roi_yr.toFixed(1)} yr` : '—'}
          </strong>
        </div>
        <div className="eq-econ-kpi">
          <span>Payback</span>
          <strong>{econ.payback_months} months</strong>
        </div>
        <div className="eq-econ-kpi">
          <span>Energy tariff</span>
          <strong>{econ.tariff_dt_mwh} DT/MWh</strong>
        </div>
        <div className="eq-econ-kpi">
          <span>Equation</span>
          <code style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{econ.equation}</code>
        </div>
      </div>
      {/* 12-year cashflow curve */}
      <Plot
        data={[
          {
            x: YEARS,
            y: YEARS.map((t) => t * econ.annual_savings_dt - econ.capex_dt),
            type: 'scatter',
            mode: 'lines+markers',
            line: { color, width: 2 },
            marker: { size: 4, color },
            fill: 'tozeroy',
            fillcolor: `${color}22`,
            hovertemplate: 'Year %{x}: %{y:,.0f} DT<extra></extra>',
          },
        ]}
        layout={{
          plot_bgcolor: 'transparent',
          paper_bgcolor: 'transparent',
          font: { color: '#94a3b8', size: 11 },
          xaxis: { title: { text: 'Year' }, gridcolor: '#1e293b', dtick: 2 },
          yaxis: { title: { text: 'Net cash flow (DT)' }, gridcolor: '#1e293b', zerolinecolor: '#475569', zeroline: true },
          margin: { l: 70, r: 10, t: 10, b: 40 },
          shapes: [
            {
              type: 'line' as const,
              xref: 'paper' as const,
              x0: 0, x1: 1,
              y0: 0, y1: 0,
              line: { color: '#475569', width: 1, dash: 'dot' },
            },
          ],
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%', height: 200, marginTop: 12 }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MCDA score mini-card
// ─────────────────────────────────────────────────────────────────
function ScoreCard({ eq }: { eq: EquipmentItem }) {
  const sc = eq.score;
  const color = EQ_COLORS[eq.id] ?? '#94a3b8';
  const criteria = [
    { key: 'C1', label: 'Energy (×0.30)', val: sc.C1 },
    { key: 'C2', label: 'CO₂ (×0.20)',   val: sc.C2 },
    { key: 'C3', label: 'Feasibility (×0.20)', val: sc.C3 },
    { key: 'C4', label: 'CAPEX (×0.15)', val: sc.C4 },
    { key: 'C5', label: 'ROI (×0.15)',   val: sc.C5 },
  ];
  return (
    <div className="eq-card eq-card--score" style={{ borderTopColor: color }}>
      <h4 className="eq-card-subtitle">
        MCDA Score
        <span className="eq-score-total" style={{ color }}>{sc.total.toFixed(2)} / 10</span>
      </h4>
      <div className="eq-score-bars">
        {criteria.map(({ key, label, val }) => (
          <div key={key} className="eq-score-row">
            <span className="eq-score-label">{label}</span>
            <div className="eq-score-bar-wrap">
              <div className="eq-score-bar-fill" style={{ width: `${val * 10}%`, background: color }} />
            </div>
            <span className="eq-score-val">{val.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main export: full equipment panel
// ─────────────────────────────────────────────────────────────────
export function WhrEquipmentPanel() {
  const { data, isLoading, isError } = useWhrEquipment();
  const [selectedId, setSelectedId] = useState<string>('EQ1');

  if (isLoading) return <div className="eq-panel-loading">Loading equipment data…</div>;
  if (isError || !data || data.length === 0) return <div className="eq-panel-error">Equipment data unavailable</div>;

  const selected = data.find((eq) => eq.id === selectedId) ?? data[0];

  return (
    <section className="eq-panel">
      <h2 className="eq-panel-title">Equipment Analysis</h2>
      <p className="eq-panel-subtitle">
        Select an equipment to view its energy balance, CO₂ profile, economic case and MCDA score.
      </p>

      {/* Equipment selector tabs */}
      <EquipmentSelector items={data} selectedId={selectedId} onSelect={setSelectedId} />

      {/* Detail grid */}
      <div className="eq-detail-grid">
        {/* Row 1 */}
        <IdentityCard eq={selected} />
        <ScoreCard eq={selected} />
        {/* Row 2 */}
        <EnergyBalanceChart eq={selected} />
        <Co2Card eq={selected} />
        {/* Row 3 */}
        <div className="eq-card--econ-full">
          <EconomicsCard eq={selected} />
        </div>
      </div>
    </section>
  );
}
