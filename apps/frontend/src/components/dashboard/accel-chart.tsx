"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useIoTStore } from '@/store/iot-store';

export function AccelChart() {
  const { history } = useIoTStore();

  if (history.length === 0) {
    return (
      <div className="accel-chart-card accel-chart-empty">
        <span>Waiting for sensor data…</span>
      </div>
    );
  }

  const data = history.map((r) => ({
    t: new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    aX: +r.ax.toFixed(3),
    aY: +r.ay.toFixed(3),
    aZ: +r.az.toFixed(3),
    flow: +r.flow.toFixed(2),
  }));

  return (
    <div className="accel-chart-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Accelerometer */}
      <div style={{ flex: 1, minHeight: 140 }}>
        <div style={{ fontSize: '0.65rem', color: '#9a8f82', textTransform: 'uppercase', marginBottom: 4, paddingLeft: 8 }}>
          Accelerometer (m/s²)
        </div>
        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={data} margin={{ top: 0, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(187, 171, 140, 0.1)" />
            <XAxis dataKey="t" tick={{ fill: '#9a8f82', fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#9a8f82', fontSize: 9 }} />
            <Tooltip
              contentStyle={{ background: '#1e202e', border: '1px solid rgba(187,171,140,0.2)', fontSize: 11 }}
              labelStyle={{ color: '#9a8f82' }}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="aX" stroke="#BBAB8C" dot={false} strokeWidth={2} isAnimationActive={false} />
            <Line type="monotone" dataKey="aY" stroke="#776B5D" dot={false} strokeWidth={2} isAnimationActive={false} />
            <Line type="monotone" dataKey="aZ" stroke="#9a8f82" dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Flow */}
      <div style={{ flex: 1, minHeight: 120 }}>
        <div style={{ fontSize: '0.65rem', color: '#9a8f82', textTransform: 'uppercase', marginBottom: 4, paddingLeft: 8 }}>
          Flow Rate (L/min)
        </div>
        <ResponsiveContainer width="100%" height={110}>
          <LineChart data={data} margin={{ top: 0, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(187, 171, 140, 0.1)" />
            <XAxis dataKey="t" tick={{ fill: '#9a8f82', fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#9a8f82', fontSize: 9 }} />
            <Tooltip
              contentStyle={{ background: '#1e202e', border: '1px solid rgba(187,171,140,0.2)', fontSize: 11 }}
              labelStyle={{ color: '#9a8f82' }}
            />
            <Line type="monotone" dataKey="flow" stroke="#BBAB8C" dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
