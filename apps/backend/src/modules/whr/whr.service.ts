import { Injectable } from '@nestjs/common';
import { WHREngine } from './engine/whr-engine';
import { WHRResult } from './engine/whr.types';
import { DEFAULTS } from './engine/whr-config';
import { WhrParamsDto } from './dto/whr-params.dto';

@Injectable()
export class WhrService {
  calculate(dto: WhrParamsDto = {}): WHRResult {
    const params = {
      t_flue_in: dto.t_flue_in ?? DEFAULTS.t_flue_in,
      t_flue_out_target: dto.t_flue_out_target ?? DEFAULTS.t_flue_out_target,
      eta_hx: dto.eta_hx ?? DEFAULTS.eta_hx,
      eta_r_comp: dto.eta_r_comp ?? DEFAULTS.eta_r_comp,
      p_gn: dto.p_gn ?? DEFAULTS.p_gn,
      p_elec: dto.p_elec ?? DEFAULTS.p_elec,
      capex_s1: dto.capex_s1 ?? DEFAULTS.capex_s1,
      capex_s2: dto.capex_s2 ?? DEFAULTS.capex_s2,
      capex_s3: dto.capex_s3 ?? DEFAULTS.capex_s3,
    };
    return new WHREngine({}, params).run();
  }

  /** Returns the three scenarios with scenario labels and savings breakdown. */
  scenarios(dto: WhrParamsDto = {}) {
    const result = this.calculate(dto);
    return [
      {
        id: 'S1',
        name: 'Économiseurs chaudières',
        description: 'Sensible heat recovery from boiler flue gas via plate heat exchanger (EQ-1).',
        equation: 'Q = V̇·Cp·ΔT·η',
        E_mwh: result.E_W1,
        Q_kw: result.Q_W1,
        co2_t: result.co2_W1,
        savings_dt: result.savings_s1,
        capex_dt: dto.capex_s1 ?? DEFAULTS.capex_s1,
        roi_yr: result.roi_s1,
        score: result.scores.W1,
      },
      {
        id: 'S2',
        name: 'WHR Compresseur',
        description: 'Reject heat from air compressor after-cooler recovery kit (EQ-4).',
        equation: 'Q = P·τ·η_p·η_r',
        E_mwh: result.E_W2,
        Q_kw: result.Q_W2,
        co2_t: result.co2_W2,
        savings_dt: result.savings_s2,
        capex_dt: dto.capex_s2 ?? DEFAULTS.capex_s2,
        roi_yr: result.roi_s2,
        score: result.scores.W2,
      },
      {
        id: 'S3',
        name: 'Désurchauffe GEG',
        description: 'Desuperheating zone of GEG chiller condensers — 12% of total condenser load (EQ-5).',
        equation: 'Q_dsh = 12%·Q_cond',
        E_mwh: result.E_W3,
        Q_kw: result.Q_W3,
        co2_t: result.co2_W3,
        savings_dt: result.savings_s3,
        capex_dt: dto.capex_s3 ?? DEFAULTS.capex_s3,
        roi_yr: result.roi_s3,
        score: result.scores.W3,
      },
    ];
  }

  defaults() {
    return DEFAULTS;
  }
}
