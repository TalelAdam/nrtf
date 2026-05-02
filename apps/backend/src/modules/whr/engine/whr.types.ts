/** Live or cached sensor readings from Part 1 IoT. */
export interface SensorData {
  /** °C — thermocouple cheminée boiler flue */
  t_flue_in?: number;
  /** Nm³/h — GN meter */
  v_gn_flow?: number;
  /** kW — compressor energy meter */
  P_comp_meas?: number;
  /** °C — GEG condenser inlet temp */
  t_GEG_in?: number;
  /** °C — GEG condenser outlet temp */
  t_GEG_out?: number;
  /** °C — CTA extract air temp */
  t_cta_extract?: number;
  /** True when at least one field comes from a live IoT reading */
  is_realtime?: boolean;
}

/** User-controlled parameters from dashboard sidebar. */
export interface UserParams {
  /** °C — flue gas inlet temperature */
  t_flue_in: number;
  /** °C — minimum flue gas outlet (acid dew point constraint ≥110°C) */
  t_flue_out_target: number;
  /** 0–1 — plate HX efficiency */
  eta_hx: number;
  /** 0–1 — compressor WHR kit recovery efficiency */
  eta_r_comp: number;
  /** DT/MWh — natural gas price */
  p_gn: number;
  /** DT/MWh — electricity price */
  p_elec: number;
  /** DT — CAPEX scenario 1 (boiler economizers) */
  capex_s1: number;
  /** DT — CAPEX scenario 2 (compressor WHR kit) */
  capex_s2: number;
  /** DT — CAPEX scenario 3 (GEG desuperheater) */
  capex_s3: number;
}

/** Per-scenario MCDA score breakdown. */
export interface ScoreBreakdown {
  C1: number;       // Energy score (0–10)
  C2: number;       // CO₂ score (0–10)
  C3: number;       // Feasibility score (0–10)
  C4: number;       // CAPEX score (0–10)
  C5: number;       // ROI score (0–10)
  total: number;    // Weighted composite score
}

/** Full result object from a single WHREngine.run() call. */
export interface WHRResult {
  // Heat powers [kW]
  Q_W1: number;
  Q_W2: number;
  Q_W3: number;
  Q_W5: number;

  // Annual energy [MWh/yr]
  E_W1: number;
  E_W2: number;
  E_W3: number;
  E_W5: number;
  E_total: number;

  // CO₂ avoided [tCO₂/yr]
  co2_W1: number;
  co2_W2: number;
  co2_W3: number;
  co2_total: number;

  // Financial [DT]
  savings_s1: number;
  savings_s2: number;
  savings_s3: number;
  savings_total: number;
  roi_s1: number;
  roi_s2: number;
  roi_s3: number;
  roi_weighted: number;

  // MCDA scores per source
  scores: Record<'W1' | 'W2' | 'W3', ScoreBreakdown>;

  // Metadata
  data_source: 'realtime' | 'static';
  warnings: string[];
}
