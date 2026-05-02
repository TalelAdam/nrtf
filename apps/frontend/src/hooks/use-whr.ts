"use client";

import { useQuery } from '@tanstack/react-query';
import { useWhrStore, WhrParams } from '@/store/whr-store';

function buildQuery(params: WhrParams): string {
  return new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    )
  ).toString();
}

export interface WHRResult {
  Q_W1: number; Q_W2: number; Q_W3: number; Q_W5: number;
  E_W1: number; E_W2: number; E_W3: number; E_W5: number; E_total: number;
  co2_W1: number; co2_W2: number; co2_W3: number; co2_total: number;
  savings_s1: number; savings_s2: number; savings_s3: number; savings_total: number;
  roi_s1: number; roi_s2: number; roi_s3: number; roi_weighted: number;
  scores: {
    W1: ScoreBreakdown; W2: ScoreBreakdown; W3: ScoreBreakdown;
  };
  data_source: 'realtime' | 'static';
  warnings: string[];
}

export interface ScoreBreakdown {
  C1: number; C2: number; C3: number; C4: number; C5: number; total: number;
}

export interface WHRScenario {
  id: string;
  name: string;
  description: string;
  equation: string;
  E_mwh: number;
  Q_kw: number;
  co2_t: number;
  savings_dt: number;
  capex_dt: number;
  roi_yr: number;
  score: ScoreBreakdown;
}

async function fetchWhrResult(params: WhrParams): Promise<WHRResult> {
  const res = await fetch(`/api/whr/calculate?${buildQuery(params)}`);
  if (!res.ok) throw new Error(`WHR API error: ${res.status}`);
  return res.json() as Promise<WHRResult>;
}

async function fetchWhrScenarios(params: WhrParams): Promise<WHRScenario[]> {
  const res = await fetch(`/api/whr/scenarios?${buildQuery(params)}`);
  if (!res.ok) throw new Error(`WHR scenarios API error: ${res.status}`);
  return res.json() as Promise<WHRScenario[]>;
}

export function useWhrResult() {
  const params = useWhrStore((s) => s.params);
  return useQuery({
    queryKey: ['whr', 'calculate', params],
    queryFn: () => fetchWhrResult(params),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useWhrScenarios() {
  const params = useWhrStore((s) => s.params);
  return useQuery({
    queryKey: ['whr', 'scenarios', params],
    queryFn: () => fetchWhrScenarios(params),
    staleTime: 30_000,
    retry: 1,
  });
}
