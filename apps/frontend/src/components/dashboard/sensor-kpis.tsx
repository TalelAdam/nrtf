"use client";

import { useState, useEffect } from 'react';
import { useIoTStore } from '@/store/iot-store';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? 'http://localhost:3000';

function fmt(v: number | undefined, decimals = 1): string {
  return v === undefined || v === null ? '--' : v.toFixed(decimals);
}

interface KpiProps {
  label: string;
  value: string;
  unit: string;
  color: string;
  icon: string;
  alert?: boolean;
}

function KpiCard({ label, value, unit, color, icon, alert }: KpiProps) {
  return (
    <div
      className="sensor-kpi"
      style={{
        borderTopColor: color,
        background: alert ? 'rgba(239,68,68,0.12)' : undefined,
        transition: 'background 300ms ease, border-top-color 300ms ease',
      }}
    >
      <span className="sensor-kpi-icon">{icon}</span>
      <div className="sensor-kpi-body">
        <span className="sensor-kpi-label">{label}</span>
        <div className="sensor-kpi-value">
          <span style={{ color, transition: 'color 300ms ease' }}>{value}</span>
          <span className="sensor-kpi-unit">{unit}</span>
        </div>
      </div>
    </div>
  );
}

export function SensorKpis() {
  const { latest, connectionStatus } = useIoTStore();
  const [spiking, setSpiking] = useState(false);

  function triggerSpike() {
    if (spiking) return;
    setSpiking(true);
    fetch(`${BACKEND}/iot/spike`).catch(() => null);
    setTimeout(() => setSpiking(false), 5000);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') triggerSpike();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spiking]);

  const accelMag = latest
    ? Math.sqrt(latest.ax ** 2 + latest.ay ** 2 + latest.az ** 2)
    : undefined;

  const flowHigh = (latest?.flow ?? 0) > 8;
  const flowColor = flowHigh ? '#ef4444' : '#BBAB8C';

  const dotClass =
    connectionStatus === 'connected'
      ? 'conn-dot connected'
      : connectionStatus === 'connecting'
        ? 'conn-dot connecting'
        : 'conn-dot disconnected';

  return (
    <div className="sensor-kpis-wrapper">
      <div className="sensor-kpis-header">
        <span className="sensor-kpis-title">Live ESP32 Sensors</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {spiking && (
            <span style={{
              fontSize: '0.6rem',
              textTransform: 'uppercase',
              color: '#ef4444',
              letterSpacing: '0.06em',
              animation: 'pulse-dot 0.8s ease-in-out infinite',
            }}>
              ⚠ SPIKE
            </span>
          )}
          <span className={dotClass}>
            <span className="conn-dot-indicator" />
            {connectionStatus}
          </span>
        </div>
      </div>
      <div className="sensor-kpis-grid">
        <KpiCard
          label="Temperature"
          value={fmt(latest?.temp)}
          unit="°C"
          color="#BBAB8C"
          icon="🌡️"
        />
        <KpiCard
          label="Humidity"
          value={fmt(latest?.hum)}
          unit="%"
          color="#776B5D"
          icon="💧"
        />
        <KpiCard
          label="Flow Rate"
          value={fmt(latest?.flow, 2)}
          unit="L/min"
          color={flowColor}
          icon={flowHigh ? '🚨' : '🌊'}
          alert={flowHigh}
        />
        <KpiCard
          label="|Accel|"
          value={fmt(accelMag, 2)}
          unit="m/s²"
          color="#9a8f82"
          icon="📡"
        />
      </div>
    </div>
  );
}
