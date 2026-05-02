"use client";

import { useIoTStore } from '@/store/iot-store';

function fmt(v: number | undefined, decimals = 1): string {
  return v === undefined || v === null ? '--' : v.toFixed(decimals);
}

interface KpiProps {
  label: string;
  value: string;
  unit: string;
  color: string;
  icon: string;
}

function KpiCard({ label, value, unit, color, icon }: KpiProps) {
  return (
    <div className="sensor-kpi" style={{ borderTopColor: color }}>
      <span className="sensor-kpi-icon">{icon}</span>
      <div className="sensor-kpi-body">
        <span className="sensor-kpi-label">{label}</span>
        <div className="sensor-kpi-value">
          <span style={{ color }}>{value}</span>
          <span className="sensor-kpi-unit">{unit}</span>
        </div>
      </div>
    </div>
  );
}

export function SensorKpis() {
  const { latest, connectionStatus } = useIoTStore();

  const accelMag = latest
    ? Math.sqrt(latest.ax ** 2 + latest.ay ** 2 + latest.az ** 2)
    : undefined;

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
        <span className={dotClass}>
          <span className="conn-dot-indicator" />
          {connectionStatus}
        </span>
      </div>
      <div className="sensor-kpis-grid">
        <KpiCard
          label="Temperature"
          value={fmt(latest?.temp)}
          unit="°C"
          color="#38bdf8"
          icon="🌡️"
        />
        <KpiCard
          label="Humidity"
          value={fmt(latest?.hum)}
          unit="%"
          color="#2dd4bf"
          icon="💧"
        />
        <KpiCard
          label="Flow Rate"
          value={fmt(latest?.flow, 2)}
          unit="L/min"
          color="#4ade80"
          icon="🌊"
        />
        <KpiCard
          label="|Accel|"
          value={fmt(accelMag, 2)}
          unit="m/s²"
          color="#fb923c"
          icon="📡"
        />
      </div>
    </div>
  );
}
