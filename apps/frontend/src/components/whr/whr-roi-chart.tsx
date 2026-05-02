"use client";

import dynamic from 'next/dynamic';
import { useWhrScenarios } from '@/hooks/use-whr';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

const COLORS: Record<string, string> = { S1: '#f59e0b', S2: '#10b981', S3: '#00d4ff' };
const YEARS = Array.from({ length: 13 }, (_, i) => i);

export function WhrRoiChart() {
  const { data, isLoading, isError } = useWhrScenarios();

  if (isLoading) return <div className="chart-placeholder">Building ROI curves…</div>;
  if (isError || !data) return <div className="chart-placeholder">ROI chart unavailable</div>;

  const traces = data.map((s) => ({
    x: YEARS,
    y: YEARS.map((yr) => yr * s.savings_dt - s.capex_dt),
    name: s.id,
    mode: 'lines+markers' as const,
    line: { color: COLORS[s.id] ?? '#888', width: 2 },
    marker: { size: 4 },
    hovertemplate: `${s.id}: %{y:,.0f} DT (yr %{x})<extra></extra>`,
  }));

  return (
    <Plot
      data={traces}
      layout={{
        title: { text: '12-Year Cumulative Cash Flow per Scenario', font: { color: '#e2e8f0', size: 14 } },
        plot_bgcolor: 'transparent',
        paper_bgcolor: 'transparent',
        font: { color: '#94a3b8' },
        xaxis: { title: { text: 'Year' }, gridcolor: '#1e293b', dtick: 1 },
        yaxis: { title: { text: 'Net Cash Flow (DT)' }, gridcolor: '#1e293b', zerolinecolor: '#475569', zeroline: true },
        legend: { font: { color: '#94a3b8' }, bgcolor: 'transparent' },
        shapes: [
          {
            type: 'line' as const,
            xref: 'paper' as const,
            x0: 0, x1: 1,
            y0: 0, y1: 0,
            line: { color: '#475569', width: 1, dash: 'dot' },
          },
        ],
        margin: { l: 70, r: 30, t: 50, b: 50 },
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: 300 }}
    />
  );
}
