"use client";

const equations = [
  {
    id: 'EQ-1',
    label: 'W1 — Flue Gas Sensible Heat',
    formula: 'Q = V̇_flue × Cp_flue × (T_in − T_out) × η_HX',
    explanation:
      'Boiler flue gas carries waste heat. We route it through a plate heat exchanger before the chimney. ' +
      'V̇ is the flue gas volume flow derived from gas meter readings, Cp is the volumetric heat capacity, ' +
      'ΔT is the temperature drop, and η is the heat exchanger efficiency.',
  },
  {
    id: 'EQ-2',
    label: 'W5 — Boiler Purge Flash',
    formula: 'Q_purge = ṁ_purge × h_fg(@5bar)',
    explanation:
      'The boiler continuously purges ~4% of steam to control dissolved solids. ' +
      'This blowdown carries latent heat that can be flashed to low-pressure steam or pre-heat feed water.',
  },
  {
    id: 'EQ-3',
    label: 'Flue Flow Derivation',
    formula: 'V̇_flue = (V̇_GN × r_stoich) / 3600    [Nm³/s]',
    explanation:
      'The stoichiometric ratio r = 11.0 Nm³_flue / Nm³_GN is used when no direct flow meter exists. ' +
      'V̇_GN comes from the GN meter mounted on the boiler feed line.',
  },
  {
    id: 'EQ-4',
    label: 'W2 — Air Compressor Reject Heat',
    formula: 'Q = P_nom × τ × η_therm × η_r',
    explanation:
      'Reciprocating air compressors reject ~70–80% of shaft power as heat in the after-cooler. ' +
      'η_therm ≈ 0.80 represents thermal losses; η_r is the WHR kit\'s recovery efficiency (0.65 from spec).',
  },
  {
    id: 'EQ-5',
    label: 'W3 — GEG Chiller Desuperheating',
    formula: 'Q_dsh = 0.12 × (Q_GEG_frig + P_GEG_comp)',
    explanation:
      '12% of the total condenser load occurs in the desuperheating zone at ≥80°C — suitable for ' +
      'domestic hot water or process pre-heat. The remaining condenser heat is too low-grade (~40°C).',
  },
];

export function WhrEquationsPanel() {
  return (
    <div className="equations-panel">
      <h3 className="equations-title">Engineering Equations</h3>
      <div className="equations-list">
        {equations.map((eq) => (
          <div className="equation-card" key={eq.id}>
            <div className="equation-header">
              <span className="equation-badge">{eq.id}</span>
              <span className="equation-label">{eq.label}</span>
            </div>
            <pre className="equation-formula">{eq.formula}</pre>
            <p className="equation-explanation">{eq.explanation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
