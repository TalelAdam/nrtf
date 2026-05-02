import { CONST, DEFAULTS, EQUIPMENT, VALID_RANGES, WEIGHTS } from './whr-config';
import { SensorData, UserParams, WHRResult, ScoreBreakdown } from './whr.types';

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export class WHREngine {
  private readonly s: SensorData;
  private readonly p: UserParams;
  private readonly warnings: string[] = [];

  constructor(sensors: Partial<SensorData> = {}, params: Partial<UserParams> = {}) {
    this.s = sensors as SensorData;
    this.p = {
      t_flue_in: DEFAULTS.t_flue_in,
      t_flue_out_target: DEFAULTS.t_flue_out_target,
      eta_hx: DEFAULTS.eta_hx,
      eta_r_comp: DEFAULTS.eta_r_comp,
      p_gn: DEFAULTS.p_gn,
      p_elec: DEFAULTS.p_elec,
      capex_s1: DEFAULTS.capex_s1,
      capex_s2: DEFAULTS.capex_s2,
      capex_s3: DEFAULTS.capex_s3,
      ...params,
    };
  }

  /** Use sensor if valid, else fallback to default with warning. */
  private resolve(sensorVal: number | undefined, defaultVal: number, name: string): number {
    if (sensorVal !== undefined) {
      const range = VALID_RANGES[name];
      if (range) {
        const [lo, hi] = range;
        if (sensorVal < lo || sensorVal > hi) {
          this.warnings.push(
            `${name}=${sensorVal} out of range [${lo},${hi}] → using default ${defaultVal}`,
          );
          return defaultVal;
        }
      }
      return sensorVal;
    }
    this.warnings.push(`${name}: no sensor → using default ${defaultVal}`);
    return defaultVal;
  }

  // ─ EQ-1 + EQ-3: W1 Flue gas from boilers ─────────────────────
  calcW1(): [number, number] {
    // Step 1: resolve T_in from sensor or default
    const T_in = this.resolve(this.s.t_flue_in, this.p.t_flue_in, 't_flue_in');
    const T_out = this.p.t_flue_out_target;

    // Step 2: derive flue gas flow via GN meter (EQ-3)
    let v_gn_nm3h: number;
    if (this.s.v_gn_flow !== undefined) {
      v_gn_nm3h = this.s.v_gn_flow;
    } else {
      // derive from nominal: P_nom × τ_boiler / η / PCI × 3600
      v_gn_nm3h =
        (EQUIPMENT.P_boiler_nom * EQUIPMENT.tau_boiler) /
        EQUIPMENT.eta_boiler /
        CONST.PCI_GN *
        3600;
    }

    const v_flue_m3s = (v_gn_nm3h * CONST.r_stoich_GN) / 3600; // Nm³/s — EQ-3

    // Step 3: sensible heat recovery (EQ-1 volumetric form)
    const Q_kw = v_flue_m3s * CONST.Cp_flue_vol * (T_in - T_out) * this.p.eta_hx;
    const E_mwh = (Q_kw * EQUIPMENT.h_boiler) / 1000;
    return [round(Q_kw, 1), round(E_mwh, 1)];
  }

  // ─ EQ-4: W2 Compressor heat recovery ─────────────────────────
  calcW2(): [number, number] {
    let tau: number;
    if (this.s.P_comp_meas !== undefined) {
      tau = Math.max(0.05, Math.min(1.0, this.s.P_comp_meas / EQUIPMENT.P_comp_nom));
    } else {
      tau = EQUIPMENT.tau_comp;
    }
    const Q_kw =
      EQUIPMENT.P_comp_nom *
      tau *
      0.8 *                  // η_thermal loss (1 - isentropic η)
      this.p.eta_r_comp;     // WHR kit efficiency
    const E_mwh = (Q_kw * EQUIPMENT.h_comp) / 1000;
    return [round(Q_kw, 1), round(E_mwh, 1)];
  }

  // ─ EQ-5: W3 GEG desuperheating ────────────────────────────────
  calcW3(): [number, number] {
    const Q_cond = EQUIPMENT.Q_GEG_frig + EQUIPMENT.P_GEG_comp;
    const Q_kw = 0.12 * Q_cond; // desuperheating fraction
    const E_mwh = (Q_kw * EQUIPMENT.h_GEG) / 1000;
    return [round(Q_kw, 1), round(E_mwh, 1)];
  }

  // ─ EQ-2: W5 Boiler purge flash ────────────────────────────────
  calcW5(): [number, number] {
    const steam_kgs = (EQUIPMENT.P_boiler_nom * EQUIPMENT.tau_boiler) / CONST.h_fg_5bar;
    const m_purge = 0.04 * steam_kgs; // 4% typical purge rate
    const Q_kw = m_purge * CONST.h_fg_5bar;
    const E_mwh = (Q_kw * EQUIPMENT.h_boiler) / 1000;
    return [round(Q_kw, 1), round(E_mwh, 1)];
  }

  // ─ CO₂ and financial calculations ─────────────────────────────
  calcCo2(E_mwh: number, energyType: 'GN' | 'elec' = 'GN'): number {
    const factor = energyType === 'GN' ? CONST.f_CO2_GN : CONST.f_CO2_elec;
    return round(E_mwh * factor, 1); // tCO₂/yr
  }

  calcSavings(E_mwh: number, energyType: 'GN' | 'elec' = 'GN'): number {
    const price = energyType === 'GN' ? this.p.p_gn : this.p.p_elec;
    return round(E_mwh * price, 0); // DT/yr
  }

  // ─ Scoring model ──────────────────────────────────────────────
  calcScores(
    resultsMap: Record<string, { E: number; co2: number; feasibility: number; capex: number; roi: number }>,
  ): Record<string, ScoreBreakdown> {
    const scoreEnergy = (e: number): number => {
      if (e >= 500) return 9.5;
      if (e >= 300) return 7.5;
      if (e >= 150) return 5.5;
      if (e >= 50) return 3.5;
      return 1.5;
    };
    const scoreCo2 = (c: number): number => {
      if (c >= 100) return 9.5;
      if (c >= 60) return 7.5;
      if (c >= 30) return 5.5;
      if (c >= 10) return 3.5;
      return 1.5;
    };
    const scoreCapex = (c: number): number => {
      if (c < 20000) return 9.5;
      if (c < 50000) return 7.5;
      if (c < 100000) return 5.5;
      if (c < 200000) return 3.5;
      return 1.5;
    };
    const scoreRoi = (r: number): number => {
      if (r < 1) return 9.5;
      if (r < 2) return 7.5;
      if (r < 3) return 5.5;
      if (r < 5) return 3.5;
      return 1.5;
    };

    const scored: Record<string, ScoreBreakdown> = {};
    for (const [srcId, d] of Object.entries(resultsMap)) {
      const c1 = scoreEnergy(d.E);
      const c2 = scoreCo2(d.co2);
      const c3 = d.feasibility;
      const c4 = scoreCapex(d.capex);
      const c5 = scoreRoi(d.roi);
      const total =
        WEIGHTS.C1_energy * c1 +
        WEIGHTS.C2_co2 * c2 +
        WEIGHTS.C3_feasibility * c3 +
        WEIGHTS.C4_capex * c4 +
        WEIGHTS.C5_roi * c5;
      scored[srcId] = { C1: c1, C2: c2, C3: c3, C4: c4, C5: c5, total: round(total, 2) };
    }
    return scored;
  }

  // ─ MAIN ENTRY POINT ───────────────────────────────────────────
  run(): WHRResult {
    // 1. Compute heat powers and annual energies
    const [Q_W1, E_W1] = this.calcW1();
    const [Q_W2, E_W2] = this.calcW2();
    const [Q_W3, E_W3] = this.calcW3();
    const [Q_W5, E_W5] = this.calcW5();

    // 2. CO₂ reductions
    const co2_W1 = this.calcCo2(E_W1, 'GN');
    const co2_W2 = this.calcCo2(E_W2, 'elec'); // replaces electric heating
    const co2_W3 = this.calcCo2(E_W3, 'elec');

    // 3. Savings and ROI per scenario
    const sav_s1 = this.calcSavings(E_W1, 'GN');
    const sav_s2 = this.calcSavings(E_W2, 'elec');
    const sav_s3 = this.calcSavings(E_W3, 'elec');
    const roi_s1 = sav_s1 > 0 ? round(this.p.capex_s1 / sav_s1, 2) : Infinity;
    const roi_s2 = sav_s2 > 0 ? round(this.p.capex_s2 / sav_s2, 2) : Infinity;
    const roi_s3 = sav_s3 > 0 ? round(this.p.capex_s3 / sav_s3, 2) : Infinity;
    const capex_total = this.p.capex_s1 + this.p.capex_s2 + this.p.capex_s3;
    const sav_total = sav_s1 + sav_s2 + sav_s3;

    // 4. Scoring model
    const srcMap = {
      W1: { E: E_W1, co2: co2_W1, feasibility: 10.0, capex: this.p.capex_s1, roi: roi_s1 },
      W2: { E: E_W2, co2: co2_W2, feasibility: 9.0, capex: this.p.capex_s2, roi: roi_s2 },
      W3: { E: E_W3, co2: co2_W3, feasibility: 7.0, capex: this.p.capex_s3, roi: roi_s3 },
    };
    const scores = this.calcScores(srcMap) as Record<'W1' | 'W2' | 'W3', ScoreBreakdown>;

    return {
      Q_W1, Q_W2, Q_W3, Q_W5,
      E_W1, E_W2, E_W3, E_W5,
      E_total: round(E_W1 + E_W2 + E_W3, 1),
      co2_W1, co2_W2, co2_W3,
      co2_total: round(co2_W1 + co2_W2 + co2_W3, 1),
      savings_s1: sav_s1, savings_s2: sav_s2, savings_s3: sav_s3,
      savings_total: sav_total,
      roi_s1, roi_s2, roi_s3,
      roi_weighted: sav_total > 0 ? round(capex_total / sav_total, 2) : 99,
      scores,
      data_source: this.s.is_realtime ? 'realtime' : 'static',
      warnings: this.warnings,
    };
  }
}
