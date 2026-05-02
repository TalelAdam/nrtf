import { create } from 'zustand';

export interface WhrParams {
  t_flue_in: number;
  t_flue_out_target: number;
  eta_hx: number;
  eta_r_comp: number;
  p_gn: number;
  p_elec: number;
  capex_s1: number;
  capex_s2: number;
  capex_s3: number;
}

interface WhrState {
  params: WhrParams;
  setParam: <K extends keyof WhrParams>(key: K, value: WhrParams[K]) => void;
  reset: () => void;
}

const DEFAULT_PARAMS: WhrParams = {
  t_flue_in: 190,
  t_flue_out_target: 130,
  eta_hx: 0.78,
  eta_r_comp: 0.65,
  p_gn: 95,
  p_elec: 165,
  capex_s1: 45000,
  capex_s2: 19000,
  capex_s3: 110000,
};

export const useWhrStore = create<WhrState>((set) => ({
  params: DEFAULT_PARAMS,

  setParam: (key, value) =>
    set((state) => ({ params: { ...state.params, [key]: value } })),

  reset: () => set({ params: DEFAULT_PARAMS }),
}));
