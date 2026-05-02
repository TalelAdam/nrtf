"use client";

import { useState, useEffect, useRef } from 'react';
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
  const { latest, connectionStatus, pushReading, tempAlert, setTempAlert } = useIoTStore();
  const [spiking, setSpiking] = useState(false);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function triggerSpike() {
    if (spiking) return;
    setSpiking(true);
    fetch(`${BACKEND}/iot/spike`).catch(() => null);
    setTimeout(() => setSpiking(false), 5000);
  }

  function triggerTempAlert() {
    if (tempAlert) return;
    // inject a fake sub-zero reading into the store
    const base = latest ?? { temp: 0, hum: 55, ax: 0, ay: 0, az: 9.81, flow: 1.2, ts: Date.now() };
    pushReading({ ...base, temp: -15, ts: Date.now() });
    setTempAlert(true);
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => {
      setTempAlert(false);
      // restore with a warm reading so the chart doesn't stay frozen
      pushReading({ ...base, ts: Date.now() });
    }, 5000);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') triggerSpike();
      if (e.key === 'a' || e.key === 'A') triggerTempAlert();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spiking, tempAlert, latest]);

  useEffect(() => {
    return () => { if (alertTimerRef.current) clearTimeout(alertTimerRef.current); };
  }, []);

  const accelMag = latest
    ? Math.sqrt(latest.ax ** 2 + latest.ay ** 2 + latest.az ** 2)
    : undefined;

  const flowHigh = (latest?.flow ?? 0) > 8;
  const flowColor = flowHigh ? '#ef4444' : '#BBAB8C';
  const tempLow = (latest?.temp ?? 99) < 0;
  const tempColor = tempLow ? '#ef4444' : '#BBAB8C';

  const dotClass =
    connectionStatus === 'connected'
      ? 'conn-dot connected'
      : connectionStatus === 'connecting'
        ? 'conn-dot connecting'
        : 'conn-dot disconnected';

  return (
    <div className="sensor-kpis-wrapper">
      {/* Temperature alert toast */}
      {tempAlert && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          background: 'rgba(239,68,68,0.95)',
          color: '#fff',
          padding: '8px 18px',
          borderRadius: 8,
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 4px 24px rgba(239,68,68,0.5)',
          animation: 'pulse-dot 0.8s ease-in-out infinite',
          whiteSpace: 'nowrap',
        }}>
          🌡️ ALERT — TEMPERATURE CRITICAL
        </div>
      )}

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
          color={tempColor}
          icon={tempLow ? '🧊' : '🌡️'}
          alert={tempLow}
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
