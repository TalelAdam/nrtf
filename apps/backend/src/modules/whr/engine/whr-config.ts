// ─── PHYSICAL CONSTANTS (do not change) ───────────────────────────
export const CONST = {
  Cp_air: 1.005,        // kJ/(kg·K)
  Cp_flue_vol: 1.36,    // kJ/(Nm³·K) — GN combustion products
  Cp_water: 4.18,       // kJ/(kg·K)
  h_fg_5bar: 2108,      // kJ/kg — vaporization enthalpy @5 bar
  r_stoich_GN: 11.0,    // Nm³_flue / Nm³_GN (stoichiometric)
  PCI_GN: 10350,        // kJ/Nm³ — natural gas lower heating value
  f_CO2_GN: 0.202,      // kgCO₂/kWh — direct combustion (IPCC)
  f_CO2_elec: 0.43,     // kgCO₂/kWh — STEG Tunisian mix
} as const;

// ─── EQUIPMENT DATA (from audit, pipeline P2) ─────────────────────
export const EQUIPMENT = {
  P_boiler_nom: 1840,   // kW installed (Mangazzini PVR15+PVR5EU)
  eta_boiler: 0.92,     // combustion efficiency
  h_boiler: 7920,       // h/yr — 330 days × 24h
  tau_boiler: 0.40,     // boiler average load — estimated
  P_comp_nom: 132,      // kW — D132RS-8A nameplate
  tau_comp: 0.39,       // load factor MEASURED from audit
  h_comp: 8400,         // h/yr — from counter 19279h/2.3yrs
  Q_GEG_frig: 2650,     // kW total cooling (6× GEG Carrier)
  P_GEG_comp: 721,      // kW GEG compressor (COP assumption)
  h_GEG: 4800,          // h/yr — seasonal (55% of 8760)
} as const;

// ─── USER DEFAULTS (overridable via sidebar) ──────────────────────
export const DEFAULTS = {
  t_flue_in: 190,            // °C — assumption, confirm with sensor
  t_flue_out_target: 130,    // °C — acid dew point constraint
  eta_hx: 0.78,              // plate HX efficiency
  eta_r_comp: 0.65,          // WHR kit efficiency
  p_gn: 95,                  // DT/MWh — BP2 tariff estimate
  p_elec: 165,               // DT/MWh — HTA STEG tariff
  capex_s1: 45000,           // DT — 2× economizers + installation
  capex_s2: 19000,           // DT — WHR kit compressor
  capex_s3: 110000,          // DT — desuperheater system
} as const;

// ─── SCORING WEIGHTS (must sum to 1.0) ────────────────────────────
export const WEIGHTS = {
  C1_energy: 0.30,
  C2_co2: 0.20,
  C3_feasibility: 0.20,
  C4_capex: 0.15,
  C5_roi: 0.15,
} as const;

// ─── SENSOR VALIDATION RANGES ─────────────────────────────────────
export const VALID_RANGES: Record<string, [number, number]> = {
  t_flue_in: [100, 350],      // °C
  tau_comp: [0.05, 1.0],
  t_cta_extract: [18, 30],    // °C
  P_comp_meas: [0, 150],      // kW
};
