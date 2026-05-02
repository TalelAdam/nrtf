"use client";

import { useWhrResult } from '@/hooks/use-whr';

function Kpi({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="kpi-card" style={{ borderTopColor: color }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color }}>
        {value}
        <span className="kpi-unit">{unit}</span>
      </div>
    </div>
  );
}

export function WhrKpiStrip() {
  const { data, isLoading, isError } = useWhrResult();

  if (isLoading) return <div className="kpi-strip kpi-strip--loading">Calculating…</div>;
  if (isError || !data) return <div className="kpi-strip kpi-strip--error">Engine offline</div>;

  return (
    <div className="kpi-strip">
      <Kpi
        label="Recoverable Energy"
        value={data.E_total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        unit=" MWh/yr"
        color="#00d4ff"
      />
      <Kpi
        label="CO₂ Avoided"
        value={data.co2_total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        unit=" tCO₂/yr"
        color="#10b981"
      />
      <Kpi
        label="Annual Savings"
        value={data.savings_total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        unit=" DT/yr"
        color="#f59e0b"
      />
      <Kpi
        label="Weighted ROI"
        value={
          isFinite(data.roi_weighted)
            ? data.roi_weighted.toFixed(1)
            : '—'
        }
        unit=" yr"
        color="#a78bfa"
      />
    </div>
  );
}
