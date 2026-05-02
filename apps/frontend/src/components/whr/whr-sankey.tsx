"use client";

import dynamic from 'next/dynamic';
import { useWhrResult } from '@/hooks/use-whr';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

export function WhrSankey() {
  const { data, isLoading, isError } = useWhrResult();

  if (isLoading) return <div className="chart-placeholder">Building Sankey…</div>;
  if (isError || !data) return <div className="chart-placeholder">Sankey unavailable</div>;

  // Nodes: 0=W1, 1=W2, 2=W3, 3=CO2 Offset, 4=Cost Savings
  const nodes = ['Flue Gas (W1)', 'Compressor (W2)', 'GEG Cond. (W3)', 'CO₂ Avoided (t)', 'Savings (DT)'];
  const sources = [0, 1, 2, 0, 1, 2];
  const targets = [3, 3, 3, 4, 4, 4];
  const values = [data.co2_W1, data.co2_W2, data.co2_W3, data.savings_s1 / 1000, data.savings_s2 / 1000, data.savings_s3 / 1000];
  const colors = ['#f59e0b80', '#10b98180', '#00d4ff80', '#f59e0b80', '#10b98180', '#00d4ff80'];

  return (
    <Plot
      data={[
        {
          type: 'sankey',
          orientation: 'h',
          node: {
            pad: 15,
            thickness: 22,
            line: { color: '#334155', width: 0.5 },
            label: nodes,
            color: ['#f59e0b', '#10b981', '#00d4ff', '#a78bfa', '#22d3ee'],
          },
          link: {
            source: sources,
            target: targets,
            value: values,
            color: colors,
          },
        } as never,
      ]}
      layout={{
        title: { text: 'Waste Heat → Recovery Flows', font: { color: '#e2e8f0', size: 14 } },
        plot_bgcolor: 'transparent',
        paper_bgcolor: 'transparent',
        font: { color: '#94a3b8', size: 12 },
        margin: { l: 20, r: 20, t: 50, b: 20 },
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: 280 }}
    />
  );
}
