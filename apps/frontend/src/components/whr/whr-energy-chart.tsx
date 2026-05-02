"use client";

import dynamic from 'next/dynamic';
import { useWhrResult } from '@/hooks/use-whr';

// Plotly must be client-side only
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

export function WhrEnergyChart() {
  const { data, isLoading, isError } = useWhrResult();

  if (isLoading) return <div className="chart-placeholder">Building chart…</div>;
  if (isError || !data) return <div className="chart-placeholder">Chart unavailable</div>;

  return (
    <Plot
      data={[
        {
          type: 'bar',
          orientation: 'h',
          x: [data.E_W1, data.E_W2, data.E_W3],
          y: ['W1 — Flue Gas', 'W2 — Compressor', 'W3 — GEG Cond.'],
          marker: { color: ['#f59e0b', '#10b981', '#00d4ff'] },
          text: [`${data.E_W1.toFixed(0)} MWh`, `${data.E_W2.toFixed(0)} MWh`, `${data.E_W3.toFixed(0)} MWh`],
          textposition: 'outside',
          hovertemplate: '%{y}: %{x:.0f} MWh/yr<extra></extra>',
        },
      ]}
      layout={{
        title: { text: 'Annual Recoverable Energy by Source', font: { color: '#e2e8f0', size: 14 } },
        plot_bgcolor: 'transparent',
        paper_bgcolor: 'transparent',
        font: { color: '#94a3b8' },
        xaxis: { title: { text: 'MWh/yr' }, gridcolor: '#1e293b', zerolinecolor: '#334155' },
        yaxis: { automargin: true },
        margin: { l: 140, r: 60, t: 50, b: 50 },
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: 280 }}
    />
  );
}
