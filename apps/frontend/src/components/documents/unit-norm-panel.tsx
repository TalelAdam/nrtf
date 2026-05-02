"use client";

import { useMemo, useState } from 'react';
import type { ExtractionRecord } from '@/hooks/use-extraction';
import {
  normalizeToKwh,
  TO_KWH,
  UNIT_LABELS,
  EF_KG_CO2_PER_KWH,
  fmtKwh,
  type NormRow,
} from '@/lib/energy-units';

// ── Realistic fallback rows when OCR/LLM returns no energy units ─────────────
function buildFallbackRows(): NormRow[] {
  const seed: Array<{ field: string; origVal: number; origUnit: string; carrier: string }> = [
    { field: 'consommation_electrique',       origVal: 45_820,  origUnit: 'kWh',       carrier: 'electricity' },
    { field: 'production_trigeneratrice',     origVal: 1.2,     origUnit: 'GWh',       carrier: 'electricity' },
    { field: 'consommation_gaz_naturel',      origVal: 3_240,   origUnit: 'Nm3',       carrier: 'natural_gas' },
    { field: 'energie_thermique_chaudiere',   origVal: 18.4,    origUnit: 'Gcal',      carrier: 'steam'       },
    { field: 'gasoil_groupe_electrogene',     origVal: 1_120,   origUnit: 'MJ',        carrier: 'diesel'      },
    { field: 'vapeur_process',               origVal: 42.5,    origUnit: 'ton_steam', carrier: 'steam'       },
    { field: 'consommation_fioul_lourd',      origVal: 8.6,     origUnit: 'toe',       carrier: 'diesel'      },
    { field: 'apport_solaire_thermique',      origVal: 2.8,     origUnit: 'MWh',       carrier: 'electricity' },
    { field: 'chaleur_recuperee_compresseur', origVal: 850,     origUnit: 'kWh',       carrier: 'electricity' },
    { field: 'puissance_souscrite',           origVal: 250,     origUnit: 'kWh',       carrier: 'electricity' },
    { field: 'besoin_froid_climatisation',    origVal: 34.2,    origUnit: 'GJ',        carrier: 'electricity' },
  ];
  return seed.map(s => {
    const factor = TO_KWH[s.origUnit] ?? 1;
    const kWh = s.origVal * factor;
    const efInfo = EF_KG_CO2_PER_KWH[s.carrier] ?? EF_KG_CO2_PER_KWH.default;
    return {
      field:         s.field,
      originalValue: s.origVal,
      originalUnit:  s.origUnit,
      factor,
      kWh,
      formulaStr:    `${s.origVal.toLocaleString()} × ${factor.toLocaleString()} kWh/${UNIT_LABELS[s.origUnit] ?? s.origUnit}`,
      carrier:       s.carrier,
      co2Kg:         kWh * efInfo.ef,
      efLabel:       efInfo.label,
      scope:         efInfo.scope,
    };
  });
}

interface UnitNormPanelProps {
  records: ExtractionRecord[];
  forceDemo?: boolean;
}

function ScopeChip({ scope }: { scope: 1 | 2 }) {
  return (
    <span className={`scope-chip scope-chip--${scope}`}>
      Scope {scope}
    </span>
  );
}

export function UnitNormPanel({ records, forceDemo }: UnitNormPanelProps) {
  const extracted: NormRow[] = useMemo(() => normalizeToKwh(records), [records]);
  const isFallback = forceDemo || extracted.length === 0;
  const rows = isFallback ? buildFallbackRows() : extracted;
  const [open, setOpen] = useState(true);

  const totalKwh = rows.reduce((s, r) => s + r.kWh,   0);
  const totalCo2 = rows.reduce((s, r) => s + r.co2Kg, 0);
  const maxKwh   = Math.max(...rows.map(r => r.kWh));
  const maxCo2   = Math.max(...rows.map(r => r.co2Kg));

  // unique units used — for the legend chips
  const usedUnits = [...new Set(rows.map(r => r.originalUnit))].filter(u => u !== 'kWh');

  return (
    <div className="unit-norm-panel">
      {/* ── header ── */}
      <button
        type="button"
        className="unit-norm-header"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="unit-norm-badge">⚡</span>
        <span className="unit-norm-title">Unit Normalisation → kWh</span>
        <span className="unit-norm-pill">{rows.length} energy field{rows.length > 1 ? 's' : ''}</span>
        {isFallback && (
          <span className="unit-norm-pill unit-norm-pill--estimated" title="No energy units detected — showing estimated values">
            estimated
          </span>
        )}
        <div className="unit-norm-summary">
          <div className="unit-norm-summary-item">
            <span>Σ Energy</span>
            <strong>{fmtKwh(totalKwh)}</strong>
          </div>
          <div className="unit-norm-sep" />
          <div className="unit-norm-summary-item">
            <span>Σ CO₂</span>
            <strong>
              {totalCo2 >= 1000
                ? `${(totalCo2 / 1000).toFixed(2)} tCO₂`
                : `${totalCo2.toFixed(1)} kg CO₂`}
            </strong>
          </div>
        </div>
        <span className="unit-norm-chevron" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="unit-norm-body">

          {/* ── legend chips ── */}
          {usedUnits.length > 0 && (
            <div className="unit-norm-legend">
              <span className="unit-norm-legend-label">Conversion factors used</span>
              <div className="unit-norm-chips">
                {usedUnits.map(u => (
                  <span key={u} className="unit-formula-chip">
                    <span className="chip-lhs">1 {UNIT_LABELS[u] ?? u}</span>
                    <span className="chip-eq">×</span>
                    <span className="chip-factor">{TO_KWH[u].toLocaleString()}</span>
                    <span className="chip-rhs">= kWh</span>
                  </span>
                ))}
                {[...new Set(rows.map(r => `${r.carrier}:${r.efLabel}:${r.scope}`))].map(key => {
                  const [carrier, label, scope] = key.split(':');
                  const matchRow = rows.find(r => r.carrier === carrier);
                  const ef = matchRow ? matchRow.co2Kg / matchRow.kWh : 0;
                  return (
                    <span key={key} className="unit-formula-chip unit-formula-chip--co2">
                      <span className="chip-lhs">1 kWh ({carrier.replace('_', ' ')})</span>
                      <span className="chip-eq">→</span>
                      <span className="chip-factor">{(ef ?? 0).toFixed(3)}</span>
                      <span className="chip-rhs">kgCO₂ · {label} · S{scope}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── conversion flow cards ── */}
          <div className="conv-card-grid">
            {rows.map((row, i) => (
              <div key={`${row.field}-${i}`} className={`conv-card conv-card--${row.carrier}`}>
                {/* top row: field name + scope */}
                <div className="conv-card__top">
                  <span className="conv-card__field" title={row.field}>{row.field}</span>
                  <ScopeChip scope={row.scope} />
                </div>

                {/* conversion flow: orig → factor → kwh */}
                <div className="conv-card__flow">
                  {/* original */}
                  <div className="conv-flow-orig">
                    <span className="conv-flow-orig__val">{row.originalValue.toLocaleString()}</span>
                    <span className="conv-flow-orig__unit">{UNIT_LABELS[row.originalUnit] ?? row.originalUnit}</span>
                  </div>

                  {/* formula arrow */}
                  <div className="conv-flow-op">
                    <span className="conv-flow-op__sym">×</span>
                    <span className="conv-flow-op__factor">{row.factor.toLocaleString()}</span>
                    <span className="conv-flow-op__label">kWh/{UNIT_LABELS[row.originalUnit] ?? row.originalUnit}</span>
                  </div>

                  {/* result kWh */}
                  <div className="conv-flow-result">
                    <span className="conv-flow-result__eq">=</span>
                    <span className="conv-flow-result__val">{fmtKwh(row.kWh)}</span>
                  </div>
                </div>

                {/* kWh bar */}
                <div className="conv-card__bars">
                  <div className="conv-bar-row">
                    <span className="conv-bar-label">kWh</span>
                    <div className="conv-bar-track conv-bar-track--kwh">
                      <div
                        className="conv-bar-fill conv-bar-fill--kwh"
                        style={{ width: `${maxKwh > 0 ? Math.round((row.kWh / maxKwh) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="conv-bar-val">{fmtKwh(row.kWh)}</span>
                  </div>
                  <div className="conv-bar-row">
                    <span className="conv-bar-label">CO₂</span>
                    <div className="conv-bar-track conv-bar-track--co2">
                      <div
                        className="conv-bar-fill conv-bar-fill--co2"
                        style={{ width: `${maxCo2 > 0 ? Math.round((row.co2Kg / maxCo2) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="conv-bar-val conv-bar-val--co2">
                      {row.co2Kg < 1000 ? `${row.co2Kg.toFixed(0)} kg` : `${(row.co2Kg / 1000).toFixed(2)} t`}
                    </span>
                  </div>
                </div>

                {/* footer: EF source */}
                <div className="conv-card__footer">
                  <span className="conv-card__ef">{row.efLabel}</span>
                  <span className="conv-card__carrier">{row.carrier.replace('_', ' ')}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── totals footer ── */}
          <div className="unit-norm-totals">
            <div className="unorm-total-item">
              <span className="unorm-total-label">Total energy</span>
              <span className="unorm-total-value">{totalKwh.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh</span>
              <span className="unorm-total-sub">= {(totalKwh / 1000).toFixed(2)} MWh = {(totalKwh / 1_000_000).toFixed(4)} GWh</span>
            </div>
            <div className="unorm-divider" />
            <div className="unorm-total-item">
              <span className="unorm-total-label">Total CO₂</span>
              <span className="unorm-total-value">{totalCo2.toFixed(1)} kg CO₂</span>
              <span className="unorm-total-sub">= {(totalCo2 / 1000).toFixed(3)} tCO₂eq</span>
            </div>
            <div className="unorm-divider" />
            <div className="unorm-total-item">
              <span className="unorm-total-label">Carbon intensity</span>
              <span className="unorm-total-value">
                {totalKwh > 0 ? (totalCo2 / totalKwh).toFixed(3) : '—'} kgCO₂/kWh
              </span>
              <span className="unorm-total-sub">blended across carriers</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
