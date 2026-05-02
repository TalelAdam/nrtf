"use client";

import { useWhrStore } from '@/store/whr-store';

interface SliderRowProps {
  label: string;
  paramKey: Parameters<ReturnType<typeof useWhrStore.getState>['setParam']>[0];
  min: number;
  max: number;
  step: number;
  value: number;
  format?: (v: number) => string;
}

function SliderRow({ label, paramKey, min, max, step, value, format }: SliderRowProps) {
  const setParam = useWhrStore((s) => s.setParam);
  const display = format ? format(value) : String(value);

  return (
    <div className="param-row">
      <label className="param-label">
        {label}
        <span className="param-val">{display}</span>
      </label>
      <input
        className="param-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setParam(paramKey, Number(e.target.value))}
      />
    </div>
  );
}

interface NumberRowProps {
  label: string;
  paramKey: Parameters<ReturnType<typeof useWhrStore.getState>['setParam']>[0];
  value: number;
  unit?: string;
}

function NumberRow({ label, paramKey, value, unit }: NumberRowProps) {
  const setParam = useWhrStore((s) => s.setParam);
  return (
    <div className="param-row">
      <label className="param-label">
        {label}
        {unit && <span className="param-unit">{unit}</span>}
      </label>
      <input
        className="param-input"
        type="number"
        value={value}
        onChange={(e) => setParam(paramKey, Number(e.target.value))}
      />
    </div>
  );
}

export function WhrParamsSidebar() {
  const { params, reset } = useWhrStore();

  return (
    <aside className="params-sidebar">
      <h2 className="params-title">Parameters</h2>

      <section className="params-section">
        <h4>Heat Exchange</h4>
        <SliderRow
          label="Flue Gas In"
          paramKey="t_flue_in"
          min={130}
          max={300}
          step={5}
          value={params.t_flue_in}
          format={(v) => `${v} °C`}
        />
        <SliderRow
          label="Flue Gas Target Out"
          paramKey="t_flue_out_target"
          min={110}
          max={160}
          step={5}
          value={params.t_flue_out_target}
          format={(v) => `${v} °C`}
        />
        <SliderRow
          label="HX Efficiency"
          paramKey="eta_hx"
          min={0.6}
          max={0.9}
          step={0.01}
          value={params.eta_hx}
          format={(v) => `${(v * 100).toFixed(0)}%`}
        />
      </section>

      <section className="params-section">
        <h4>Compressor WHR</h4>
        <SliderRow
          label="WHR Kit Efficiency"
          paramKey="eta_r_comp"
          min={0.5}
          max={0.8}
          step={0.01}
          value={params.eta_r_comp}
          format={(v) => `${(v * 100).toFixed(0)}%`}
        />
      </section>

      <section className="params-section">
        <h4>Energy Tariffs</h4>
        <NumberRow label="GN Price" paramKey="p_gn" value={params.p_gn} unit="DT/MWh" />
        <NumberRow label="Electricity" paramKey="p_elec" value={params.p_elec} unit="DT/MWh" />
      </section>

      <section className="params-section">
        <h4>CAPEX Estimates</h4>
        <NumberRow label="S1 Économiseurs" paramKey="capex_s1" value={params.capex_s1} unit="DT" />
        <NumberRow label="S2 Compresseur" paramKey="capex_s2" value={params.capex_s2} unit="DT" />
        <NumberRow label="S3 Désurchauffe" paramKey="capex_s3" value={params.capex_s3} unit="DT" />
      </section>

      <button className="param-reset" onClick={reset}>
        Reset to Audit Defaults
      </button>
    </aside>
  );
}
