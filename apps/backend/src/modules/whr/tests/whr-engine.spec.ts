import { WHREngine } from '../engine/whr-engine';
import { DEFAULTS, EQUIPMENT } from '../engine/whr-config';

describe('WHREngine — static mode (default sensor data)', () => {
  let result: ReturnType<WHREngine['run']>;

  beforeAll(() => {
    result = new WHREngine({}, {}).run();
  });

  it('should have data_source = "static"', () => {
    expect(result.data_source).toBe('static');
  });

  // ─ EQ-1: W1 Flue gas recovery ────────────────────────────────
  it('E_W1 should be ~428 MWh/yr from audit constants', () => {
    // v_gn = 1840 × 0.40 / 0.92 / 10350 × 3600 = 278.3 Nm³/h
    // v_flue = 278.3 × 11 / 3600 = 0.8507 Nm³/s
    // Q = 0.8507 × 1.36 × 60 × 0.78 = 54.1 kW
    // E = 54.1 × 7920 / 1000 = 428.8 MWh
    expect(result.E_W1).toBeGreaterThan(350);
    expect(result.E_W1).toBeLessThan(510);
    expect(result.Q_W1).toBeGreaterThan(40);
    expect(result.Q_W1).toBeLessThan(70);
  });

  // ─ EQ-4: W2 Compressor heat recovery ─────────────────────────
  it('E_W2 should be ~225 MWh/yr from audit constants', () => {
    // Q = 132 × 0.39 × 0.80 × 0.65 = 26.8 kW
    // E = 26.8 × 8400 / 1000 = 225 MWh
    expect(result.E_W2).toBeGreaterThan(180);
    expect(result.E_W2).toBeLessThan(280);
    expect(result.Q_W2).toBeGreaterThan(20);
    expect(result.Q_W2).toBeLessThan(35);
  });

  // ─ EQ-5: W3 GEG Desuperheating ───────────────────────────────
  it('E_W3 should be ~1941 MWh/yr from audit constants', () => {
    // Q_cond = 2650 + 721 = 3371 kW; Q_dsh = 0.12 × 3371 = 404.5 kW
    // E = 404.5 × 4800 / 1000 = 1941.6 MWh
    expect(result.E_W3).toBeGreaterThan(1600);
    expect(result.E_W3).toBeLessThan(2300);
    expect(result.Q_W3).toBeGreaterThan(350);
    expect(result.Q_W3).toBeLessThan(470);
  });

  // ─ EQ-2: W5 Boiler purge flash ──────────────────────────────
  it('E_W5 (purge flash) should be a positive value', () => {
    expect(result.E_W5).toBeGreaterThan(0);
    expect(result.Q_W5).toBeGreaterThan(0);
  });

  // ─ Totals ────────────────────────────────────────────────────
  it('E_total should be sum of W1+W2+W3 (≈2595 MWh)', () => {
    const computed = Math.round((result.E_W1 + result.E_W2 + result.E_W3) * 10) / 10;
    expect(result.E_total).toBeCloseTo(computed, 0);
    expect(result.E_total).toBeGreaterThan(2000);
  });

  it('CO₂ total should be positive', () => {
    expect(result.co2_total).toBeGreaterThan(0);
    expect(result.co2_W1).toBeGreaterThan(0);
  });

  it('Savings should be positive with default tariffs', () => {
    // p_gn=95, p_elec=165 DT/MWh
    expect(result.savings_s1).toBeGreaterThan(0);
    expect(result.savings_s2).toBeGreaterThan(0);
    expect(result.savings_s3).toBeGreaterThan(0);
  });

  it('ROI years should be positive and finite', () => {
    expect(Number.isFinite(result.roi_s1)).toBe(true);
    expect(result.roi_s1).toBeGreaterThan(0);
    expect(Number.isFinite(result.roi_s2)).toBe(true);
    expect(result.roi_s2).toBeGreaterThan(0);
    expect(Number.isFinite(result.roi_s3)).toBe(true);
    expect(result.roi_s3).toBeGreaterThan(0);
  });

  // ─ MCDA scores ───────────────────────────────────────────────
  it('MCDA scores should have W1, W2, W3 and all components 0–10', () => {
    for (const src of ['W1', 'W2', 'W3'] as const) {
      const sc = result.scores[src];
      expect(sc).toBeDefined();
      expect(sc.C1).toBeGreaterThanOrEqual(0);
      expect(sc.C1).toBeLessThanOrEqual(10);
      expect(sc.total).toBeGreaterThanOrEqual(0);
      expect(sc.total).toBeLessThanOrEqual(10);
    }
  });
});

describe('WHREngine — sensor override', () => {
  it('should switch to realtime when sensors provided', () => {
    const r = new WHREngine({ t_flue_in: 210, is_realtime: true }, {}).run();
    expect(r.data_source).toBe('realtime');
    // Higher flue temp → more heat recovered vs default 190°C
    const baseline = new WHREngine({}, {}).run();
    expect(r.E_W1).toBeGreaterThan(baseline.E_W1);
  });

  it('should clamp and warn when sensor value is out of range', () => {
    const r = new WHREngine({ t_flue_in: 50 }, {}).run(); // 50 < min 100
    expect(r.warnings.some((w) => w.includes('t_flue_in'))).toBe(true);
    // Should fall back to default
    const baseline = new WHREngine({}, {}).run();
    expect(r.E_W1).toBeCloseTo(baseline.E_W1, 0);
  });
});

describe('WHREngine — param sensitivity', () => {
  it('higher eta_hx should produce more W1 energy', () => {
    const lo = new WHREngine({}, { eta_hx: 0.60 }).run();
    const hi = new WHREngine({}, { eta_hx: 0.90 }).run();
    expect(hi.E_W1).toBeGreaterThan(lo.E_W1);
  });

  it('higher tariff should not change energy but increase savings', () => {
    const base = new WHREngine({}, { p_gn: 95 }).run();
    const expensive = new WHREngine({}, { p_gn: 150 }).run();
    expect(base.E_W1).toBeCloseTo(expensive.E_W1, 1);
    expect(expensive.savings_s1).toBeGreaterThan(base.savings_s1);
  });
});
