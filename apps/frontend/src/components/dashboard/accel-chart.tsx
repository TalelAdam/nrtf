"use client";

import dynamic from 'next/dynamic';
import type { Data, Layout } from 'plotly.js';
import { useIoTStore } from '@/store/iot-store';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

const DARK_BG = '#0a0f1e';
const GRID_COLOR = 'rgba(0,229,255,0.08)';

export function AccelChart() {
  const { history } = useIoTStore();

  const xs = history.map((r) => new Date(r.ts));
  const ax = history.map((r) => r.ax);
  const ay = history.map((r) => r.ay);
  const az = history.map((r) => r.az);

  const traces: Data[] = [
    {
      x: xs,
      y: ax,
      name: 'aX',
      type: 'scatter',
      mode: 'lines',
      line: { color: '#ef4444', width: 2 },
    },
    {
      x: xs,
      y: ay,
      name: 'aY',
      type: 'scatter',
      mode: 'lines',
      line: { color: '#22c55e', width: 2 },
    },
    {
      x: xs,
      y: az,
      name: 'aZ',
      type: 'scatter',
      mode: 'lines',
      line: { color: '#3b82f6', width: 2 },
    },
  ];

  const layout: Partial<Layout> = {
    paper_bgcolor: DARK_BG,
    plot_bgcolor: DARK_BG,
    margin: { t: 28, r: 12, b: 36, l: 48 },
    font: { color: '#94a3b8', size: 11 },
    title: {
      text: 'Accelerometer (m/s²)',
      font: { color: '#e2e8f0', size: 12 },
      x: 0.01,
    },
    legend: {
      orientation: 'h',
      y: 1.12,
      font: { size: 11 },
    },
    xaxis: {
      gridcolor: GRID_COLOR,
      linecolor: GRID_COLOR,
      tickfont: { size: 9 },
      type: 'date',
    },
    yaxis: {
      gridcolor: GRID_COLOR,
      linecolor: GRID_COLOR,
      tickfont: { size: 9 },
      zeroline: true,
      zerolinecolor: GRID_COLOR,
    },
  };

  if (history.length === 0) {
    return (
      <div className="accel-chart-card accel-chart-empty">
        <span>Waiting for sensor data…</span>
      </div>
    );
  }

  return (
    <div className="accel-chart-card">
      <Plot
        data={traces}
        layout={layout}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler
      />
    </div>
  );
}
