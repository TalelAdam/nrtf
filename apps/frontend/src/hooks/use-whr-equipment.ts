"use client";

import { useQuery } from '@tanstack/react-query';
import { useWhrStore, WhrParams } from '@/store/whr-store';

// ── Types mirroring the backend EquipmentItem shape ──────────────

export interface ScoreBreakdown {
  C1: number; C2: number; C3: number; C4: number; C5: number; total: number;
}

export interface EnergyBalance {
  input_mwh: number;
  useful_output_mwh: number;
  loss_mwh: number;
  recoverable_mwh: number;
  recoverable_kw: number;
  energy_source: string;
  unit_note: string;
}

export interface Co2Profile {
  annual_t: number;
  avoidable_t: number;
  avoidable_pct: number;
  factor_kg_kwh: number;
  factor_source: string;
  scope: string;
}

export interface Economics {
  annual_savings_dt: number;
  capex_dt: number;
  roi_yr: number;
  payback_months: number;
  tariff_dt_mwh: number;
  equation: string;
}

export interface EquipmentItem {
  id: 'EQ1' | 'EQ2';
  scenario: string;
  name: string;
  short_name: string;
  type: string;
  manufacturer: string;
  model: string;
  location: string;
  rated_power_kw: number;
  annual_hours: number;
  load_factor: number;
  efficiency_pct: number;
  energy_balance: EnergyBalance;
  co2: Co2Profile;
  economics: Economics;
  score: ScoreBreakdown;
  whr_method: string;
  equation: string;
}

// ── Fetch helper ─────────────────────────────────────────────────

function buildQuery(params: WhrParams): string {
  return new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
  ).toString();
}

async function fetchEquipment(params: WhrParams): Promise<EquipmentItem[]> {
  const res = await fetch(`/api/whr/equipment?${buildQuery(params)}`);
  if (!res.ok) throw new Error(`WHR equipment API error: ${res.status}`);
  return res.json() as Promise<EquipmentItem[]>;
}

// ── Hook ─────────────────────────────────────────────────────────

export function useWhrEquipment() {
  const params = useWhrStore((s) => s.params);
  return useQuery({
    queryKey: ['whr', 'equipment', params],
    queryFn: () => fetchEquipment(params),
    staleTime: 30_000,
    retry: 1,
  });
}
