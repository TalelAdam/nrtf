import { Injectable } from '@nestjs/common';
import { WHREngine } from './engine/whr-engine';
import { WHRResult } from './engine/whr.types';
import { CONST, DEFAULTS, EQUIPMENT, WEIGHTS } from './engine/whr-config';
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

  // ─────────────────────────────────────────────────────────────────
  // GET /whr/equipment   — per-equipment analysis
  // Returns a list of 2 equipment items.  Each item carries:
  //   • identity       — name, type, location, rating
  //   • energy_balance — annual input/output/loss/recoverable (MWh/yr)
  //   • co2            — annual emissions + avoidable share (tCO₂/yr)
  //   • economics      — savings, CAPEX, simple ROI, payback (months)
  //   • score          — MCDA breakdown (C1–C5) from the live engine
  //   • operating      — annual hours, load factor, efficiency
  //   • scenario       — mapped WHR scenario ID
  // All numeric results are recalculated from dto params so sliders
  // affect the equipment view in real time.
  // ─────────────────────────────────────────────────────────────────
  equipment(dto: WhrParamsDto = {}) {
    const result = this.calculate(dto);

    const p_gn   = dto.p_gn   ?? DEFAULTS.p_gn;     // DT/MWh — gas tariff
    const p_elec = dto.p_elec ?? DEFAULTS.p_elec;   // DT/MWh — electricity tariff
    const capex_s1 = dto.capex_s1 ?? DEFAULTS.capex_s1;
    const capex_s2 = dto.capex_s2 ?? DEFAULTS.capex_s2;

    // ── EQ1: Boiler (Mangazzini PVR15 + PVR5EU) ──────────────────
    // Annual gas consumption (MWh/yr) derived from engine formula
    const gas_input_mwh   = (EQUIPMENT.P_boiler_nom * EQUIPMENT.tau_boiler / EQUIPMENT.eta_boiler * EQUIPMENT.h_boiler) / 1000;
    // Useful steam output (MWh/yr)
    const steam_useful_mwh = (EQUIPMENT.P_boiler_nom * EQUIPMENT.tau_boiler * EQUIPMENT.h_boiler) / 1000;
    // Flue gas heat loss (MWh/yr) — (1 - η_comb) fraction of input
    const boiler_loss_mwh  = gas_input_mwh * (1 - EQUIPMENT.eta_boiler);
    // Current CO₂ from gas combustion (tCO₂/yr)
    const boiler_co2_t     = gas_input_mwh * CONST.f_CO2_GN;
    // WHR recovery potential from this equipment
    const savings_boiler   = result.savings_s1;
    const roi_boiler       = result.roi_s1;

    // ── EQ2: Air Compressor (D132RS-8A 132 kW) ───────────────────
    // Total electrical input consumed by the compressor (MWh/yr)
    const comp_input_mwh   = (EQUIPMENT.P_comp_nom * EQUIPMENT.tau_comp * EQUIPMENT.h_comp) / 1000;
    // Useful compressed-air output (~85% of electrical input after losses)
    const comp_useful_mwh  = comp_input_mwh * 0.85;
    // Heat rejected to atmosphere (after-cooler) — ~15% losses + recoverable portion
    const comp_heat_mwh    = comp_input_mwh - comp_useful_mwh;
    // Current CO₂ from STEG electricity (tCO₂/yr)
    const comp_co2_t       = comp_input_mwh * CONST.f_CO2_elec;
    // WHR recovery potential (from engine W2)
    const savings_comp     = result.savings_s2;
    const roi_comp         = result.roi_s2;

    return [
      {
        id: 'EQ1',
        scenario: 'S1',
        name: 'Chaudières vapeur',
        short_name: 'Boiler',
        type: 'Steam Boiler',
        manufacturer: 'Mangazzini',
        model: 'PVR15 + PVR5EU',
        location: 'Salle chaudières — Zone Utilités',
        // Nameplate & operating params
        rated_power_kw: EQUIPMENT.P_boiler_nom,
        annual_hours: EQUIPMENT.h_boiler,
        load_factor: EQUIPMENT.tau_boiler,
        efficiency_pct: Math.round(EQUIPMENT.eta_boiler * 100),
        flue_temp_in_c: dto.t_flue_in ?? DEFAULTS.t_flue_in,
        flue_temp_out_c: dto.t_flue_out_target ?? DEFAULTS.t_flue_out_target,
        // Energy balance (MWh/yr)
        energy_balance: {
          input_mwh: Math.round(gas_input_mwh),
          useful_output_mwh: Math.round(steam_useful_mwh),
          loss_mwh: Math.round(boiler_loss_mwh),
          recoverable_mwh: Math.round(result.E_W1),
          recoverable_kw: Math.round(result.Q_W1),
          energy_source: 'Natural gas (GN)',
          unit_note: 'Gas input = P_nom × τ / η_comb × h_yr',
        },
        // CO₂ profile
        co2: {
          annual_t: Math.round(boiler_co2_t),
          avoidable_t: Math.round(result.co2_W1),
          avoidable_pct: Math.round((result.co2_W1 / boiler_co2_t) * 100),
          factor_kg_kwh: CONST.f_CO2_GN,
          factor_source: 'IPCC (scope 1 — direct combustion GN)',
          scope: 'Scope 1',
        },
        // Economics
        economics: {
          annual_savings_dt: Math.round(savings_boiler),
          capex_dt: capex_s1,
          roi_yr: Math.round(roi_boiler * 10) / 10,
          payback_months: Math.round((capex_s1 / savings_boiler) * 12),
          tariff_dt_mwh: p_gn,
          equation: 'Savings = E_W1 × p_gn',
        },
        // MCDA score from live engine
        score: result.scores.W1,
        // WHR method
        whr_method: 'Plate heat exchanger on flue gas duct (EQ-1 + EQ-3)',
        equation: 'Q = V̇_fumées × Cp_vol × (T_in − T_out) × η_HX',
      },

      {
        id: 'EQ2',
        scenario: 'S2',
        name: 'Compresseur air comprimé',
        short_name: 'Compressor',
        type: 'Screw Air Compressor',
        manufacturer: 'Atlas Copco',
        model: 'D132RS-8A',
        location: 'Local compresseurs — Zone Utilités',
        // Nameplate & operating params
        rated_power_kw: EQUIPMENT.P_comp_nom,
        annual_hours: EQUIPMENT.h_comp,
        load_factor: EQUIPMENT.tau_comp,
        efficiency_pct: Math.round(DEFAULTS.eta_r_comp * 100),
        heat_rejection_temp_c: '60–80°C (after-cooler outlet)',
        // Energy balance (MWh/yr)
        energy_balance: {
          input_mwh: Math.round(comp_input_mwh),
          useful_output_mwh: Math.round(comp_useful_mwh),
          loss_mwh: Math.round(comp_heat_mwh),
          recoverable_mwh: Math.round(result.E_W2),
          recoverable_kw: Math.round(result.Q_W2),
          energy_source: 'STEG electricity',
          unit_note: 'Input = P_nom × τ_charge × h_yr',
        },
        // CO₂ profile
        co2: {
          annual_t: Math.round(comp_co2_t),
          avoidable_t: Math.round(result.co2_W2),
          avoidable_pct: Math.round((result.co2_W2 / comp_co2_t) * 100),
          factor_kg_kwh: CONST.f_CO2_elec,
          factor_source: 'STEG Tunisian grid mix (scope 2)',
          scope: 'Scope 2',
        },
        // Economics
        economics: {
          annual_savings_dt: Math.round(savings_comp),
          capex_dt: capex_s2,
          roi_yr: Math.round(roi_comp * 10) / 10,
          payback_months: Math.round((capex_s2 / savings_comp) * 12),
          tariff_dt_mwh: p_elec,
          equation: 'Savings = E_W2 × p_elec',
        },
        // MCDA score from live engine
        score: result.scores.W2,
        // WHR method
        whr_method: 'After-cooler heat recovery kit — hot water loop (EQ-4)',
        equation: 'Q = P_élec × τ_charge × η_pertes × η_récup',
      },
    ];
  }

  // ─────────────────────────────────────────────────────────────────
  // GET /whr/analytics — full framework payload (§1–§8)
  // Integrates every section of the Waste Heat Recovery Engineering
  // Report v2.0 (NRTF Hackathon 2024–2025, Track B Part 3).
  // ─────────────────────────────────────────────────────────────────
  analytics(dto: WhrParamsDto = {}) {
    const result  = this.calculate(dto);
    const scenariosData = this.scenarios(dto);

    const capex_s1 = dto.capex_s1 ?? DEFAULTS.capex_s1;
    const capex_s2 = dto.capex_s2 ?? DEFAULTS.capex_s2;
    const capex_s3 = dto.capex_s3 ?? DEFAULTS.capex_s3;
    const capex_total = capex_s1 + capex_s2 + capex_s3;

    // ── §5 ROI: 12-year cumulative cashflow curves ─────────────────
    const years = Array.from({ length: 13 }, (_, i) => i); // 0…12
    const roiCurves = {
      S1: years.map((t) => ({
        year: t,
        cashflow: Math.round(result.savings_s1 * t - capex_s1),
      })),
      S2: years.map((t) => ({
        year: t,
        cashflow: Math.round(result.savings_s2 * t - capex_s2),
      })),
      S3: years.map((t) => ({
        year: t,
        cashflow: Math.round(result.savings_s3 * t - capex_s3),
      })),
      combined: years.map((t) => ({
        year: t,
        cashflow: Math.round(result.savings_total * t - capex_total),
      })),
    };

    // ── §1 Tri-génération critical gap alert ──────────────────────
    const triGenGap = {
      installed_kw: 1270,
      measured_kwh_h: 419,
      gap_kw: 851,
      message:
        'Tri-génération : 851 kW non valorisés (1 270 kW installés − 419 kWh/h mesurés). ' +
        'Opportunité immédiate si la demande de chaleur peut être augmentée. ' +
        'Signal d\'expertise différenciant de ce dossier.',
    };

    // ── §1 All 8 heat sources (W1–W8) ─────────────────────────────
    const sources = [
      {
        id: 'W1',
        name: 'Fumées chaudières vapeur',
        category: 'Utilités',
        equipment: 'Mangazzini PVR15 + PVR5EU (1 840 kW)',
        t_source: '190→130°C',
        t_level: 'Moyenne',
        P_brute_kw: 56,
        availability: 'Batch/continu',
        computed_Q_kw: result.Q_W1,
        computed_E_mwh: result.E_W1,
        scenario: 'S1',
        in_top3: true,
      },
      {
        id: 'W2',
        name: 'Chaleur compression air comprimé',
        category: 'Utilités',
        equipment: 'Compresseur D132RS-8A (132 kW, 39% charge)',
        t_source: '60–80°C',
        t_level: 'Basse',
        P_brute_kw: 41,
        availability: 'Quasi-continu 24/7',
        computed_Q_kw: result.Q_W2,
        computed_E_mwh: result.E_W2,
        scenario: 'S2',
        in_top3: true,
      },
      {
        id: 'W3',
        name: 'Chaleur condenseurs GEG (air)',
        category: 'Utilités',
        equipment: '6 GEG Carrier (2 650 kW frig total)',
        t_source: '35–45°C',
        t_level: 'Très basse',
        P_brute_kw: 3371,
        availability: 'Continu (saisonnier)',
        computed_Q_kw: result.Q_W3,
        computed_E_mwh: result.E_W3,
        scenario: 'S3',
        in_top3: true,
      },
      {
        id: 'W4',
        name: 'Air extrait CTA (salles classées)',
        category: 'HVAC',
        equipment: '17 CTA (Zones α, β, γ) — 22 ± 3°C',
        t_source: '22–24°C',
        t_level: 'Très basse',
        P_brute_kw: 150,
        availability: 'Continu',
        computed_Q_kw: null,
        computed_E_mwh: null,
        scenario: null,
        in_top3: false,
        note: 'PAC requise (T° basse) — intégration CTA en salle classée GMP pénalisante (C3=3). Priorité basse.',
      },
      {
        id: 'W5',
        name: 'Purges chaudières vapeur',
        category: 'Utilités',
        equipment: 'Chaudières 5 bars (152°C saturée)',
        t_source: '152°C',
        t_level: 'Moyenne',
        P_brute_kw: 28,
        availability: 'Continu',
        computed_Q_kw: result.Q_W5,
        computed_E_mwh: result.E_W5,
        scenario: null,
        in_top3: false,
        note: 'Énergie très faible (28 kW · batch). Valider ṁ_purge par débitmètre avant décision.',
      },
      {
        id: 'W6',
        name: 'Pertes résiduelles Tri-génération',
        category: 'Utilités',
        equipment: 'Moteur GN (20% GN non récupéré)',
        t_source: '35–55°C',
        t_level: 'Très basse',
        P_brute_kw: 372,
        availability: 'Continu (si moteur en marche)',
        computed_Q_kw: null,
        computed_E_mwh: null,
        scenario: null,
        in_top3: false,
        note: 'Valorisable si demande chaleur augmentée — voir gap tri-gen 851 kW.',
      },
      {
        id: 'W7',
        name: 'Fumées chaudières eau chaude',
        category: 'Utilités',
        equipment: 'Chappee 348 kW + Viadrus 400 kW',
        t_source: '~160°C',
        t_level: 'Moyenne',
        P_brute_kw: null,
        availability: 'Intermittent (backup)',
        computed_Q_kw: null,
        computed_E_mwh: null,
        scenario: null,
        in_top3: false,
        note: 'Chaudières backup — calcul conditionnel à usage réel, non inclus dans scénarios.',
      },
      {
        id: 'W8',
        name: 'Condensats vapeur non retournés',
        category: 'Utilités',
        equipment: 'Réseau vapeur 5 bar',
        t_source: '80–100°C',
        t_level: 'Basse',
        P_brute_kw: null,
        availability: 'Batch',
        computed_Q_kw: null,
        computed_E_mwh: null,
        scenario: null,
        in_top3: false,
        note: 'Variable — à quantifier par débitmètre temporaire.',
      },
    ];

    // ── §2 Equations EQ-1 to EQ-5 ─────────────────────────────────
    const equations = [
      {
        id: 'EQ-1',
        name: 'Chaleur sensible — fluides sans changement de phase',
        formula: 'Q [kW] = ṁ [kg/s] × Cp [kJ/(kg·K)] × (T_source − T_cible) × η_échangeur',
        variables: {
          'm_dot': 'Débit massique du fluide caloporteur (kg/s)',
          'Cp': `Chaleur spécifique : eau ${CONST.Cp_water} ; air sec ${CONST.Cp_air} ; fumées GN ~1,08 kJ/(kg·K)`,
          'T_source': 'Température d\'entrée disponible à la source (°C)',
          'T_cible': `Température de sortie minimale (T_cible ≥ 130°C pour fumées GN — contrainte rosée acide ~55°C + marge 75°C)`,
          'eta_hx': `Efficacité thermique échangeur (0,65–0,85 pour plaques inox). Valeur retenue : ${dto.eta_hx ?? DEFAULTS.eta_hx}`,
        },
        applicability:
          'Flux monophasiques sans changement d\'état. Cp supposé constant si ΔT < 100°C gaz, < 50°C liquides.',
        limits:
          'Erreur ±10–15% si ṁ estimé. Ne s\'applique pas aux condensats vapeur (→ EQ-2). Cp fumées GN varie ±3% selon composition.',
        sources_used: ['W1', 'W2', 'W4'],
        why:
          'Équation fondamentale du 1er principe pour flux continus. Calcul direct de la puissance récupérable connaissant les conditions amont/aval.',
      },
      {
        id: 'EQ-2',
        name: 'Chaleur latente — vapeur flash (condensats, purges)',
        formula: 'Q_purge [kW] = ṁ_purge [kg/s] × h_fg [kJ/kg]',
        variables: {
          'm_purge': 'Débit de purge : 3–5% du débit vapeur total × charge 40%',
          'h_fg': `Enthalpie de vaporisation à 5 bar ≈ ${CONST.h_fg_5bar} kJ/kg (tables vapeur saturée)`,
        },
        applicability:
          'Flux biphasiques avec changement d\'état. Purges à température de saturation (152°C, 5 bar).',
        limits:
          'ṁ_purge non mesuré — estimé par fraction standard industrie 3–5%. Erreur potentielle ±30% sur ce paramètre. Vérifier avec débitmètre temporaire.',
        sources_used: ['W5'],
        why:
          'Spécifique aux flux biphasiques : récupère chaleur sensible + latente du flash vapeur. Non interchangeable avec EQ-1.',
      },
      {
        id: 'EQ-3',
        name: 'Chaleur fumées via volume (méthode volumique)',
        formula: 'Q_fumées [kW] = V̇_fumées [Nm³/s] × Cp_vol [kJ/(Nm³·K)] × (T_in − T_out) × η',
        variables: {
          'V_dot_fumees': `Débit volumique fumées = V̇_GN × ${CONST.r_stoich_GN} Nm³_fumées/Nm³_GN (rapport stœchiométrique CH₄)`,
          'Cp_vol': `${CONST.Cp_flue_vol} kJ/(Nm³·K) — fumées GN (CO₂ + H₂O + N₂ + O₂ excès)`,
          'V_dot_GN': `P_chaud × τ / η_comb / PCI × 3600 = ${EQUIPMENT.P_boiler_nom} × ${EQUIPMENT.tau_boiler} / ${EQUIPMENT.eta_boiler} / ${CONST.PCI_GN} × 3600 ≈ 278 Nm³/h`,
          'T_out_min': `≥ 130°C (rosée acide ~55°C + marge 75°C sécurité). Défaut : ${dto.t_flue_out_target ?? DEFAULTS.t_flue_out_target}°C`,
        },
        applicability:
          'Utilisé quand débit massique non mesurable directement. Exploite le compteur GN existant et le rapport stœchiométrique connu.',
        limits:
          `Précision ±15%. T_out ≥ 130°C obligatoire — risque corrosion SO₂ si condensation acide en dessous. Cp_vol varie ±3% selon composition réseau.`,
        sources_used: ['W1'],
        why:
          'Méthode volumique justifiée car aucun débitmètre sur cheminée — le compteur GN est la seule donnée mesurée disponible.',
      },
      {
        id: 'EQ-4',
        name: 'Chaleur compresseur (bilan boîte noire)',
        formula: 'Q_récup = P_élec × τ_charge × η_perte × η_récup',
        variables: {
          'P_elec': `Puissance électrique installée : ${EQUIPMENT.P_comp_nom} kW (plaque constructeur D132RS-8A)`,
          'tau_charge': `Taux de charge moyen : ${EQUIPMENT.tau_comp} (mesuré via compteur audit p.11)`,
          'eta_perte': '0,80 — fraction énergie électrique dissipée en chaleur (rendement isentropique ~20% à 8 bars)',
          'eta_recup': `${dto.eta_r_comp ?? DEFAULTS.eta_r_comp} — efficacité kit WHR after-cooler eau/eau (standard constructeur 60–75%)`,
        },
        applicability:
          'Compresseur à vis oil-free : 80% énergie électrique → chaleur thermique. After-cooler eau/eau récupère cette chaleur à 55–65°C.',
        limits:
          `η_récup = ${dto.eta_r_comp ?? DEFAULTS.eta_r_comp} valeur standard — confirmer avec constructeur. τ_charge = ${EQUIPMENT.tau_comp} mesuré (fiable).`,
        sources_used: ['W2'],
        why:
          'Bilan boîte noire justifié car le compresseur est un système fermé dont les seules mesures disponibles sont P_élec et le compteur horaire.',
        numerical_result: `Q = ${EQUIPMENT.P_comp_nom} × ${EQUIPMENT.tau_comp} × 0,80 × ${dto.eta_r_comp ?? DEFAULTS.eta_r_comp} = ${result.Q_W2} kW · E = ${result.E_W2} MWh/an`,
      },
      {
        id: 'EQ-5',
        name: 'Désurchauffe condenseurs GEG',
        formula: 'Q_désurchauffe = 12% × (Q_frig + P_compresseur_GEG)',
        variables: {
          'Q_frig': `${EQUIPMENT.Q_GEG_frig} kW — refroidissement total 6× GEG Carrier`,
          'P_comp_GEG': `${EQUIPMENT.P_GEG_comp} kW — puissance compresseur GEG (bilan COP)`,
          'Q_cond_total': `${EQUIPMENT.Q_GEG_frig + EQUIPMENT.P_GEG_comp} kW — bilan 1er principe cycle frigorifique`,
          'fraction_12pct': 'Fraction désurchauffe / chaleur condensation totale — typique R134a à taux de compression 3–5',
          'T_desurchauffe': '55–70°C — vapeur surchauffée en sortie compresseur GEG avant condensation',
        },
        applicability:
          'Réfrigérant R134a quitte le compresseur à ~60–80°C (vapeur surchauffée). Cette phase (10–15% chaleur totale) est à température utile pour ECS.',
        limits:
          'Fraction 12% est une moyenne R134a — vérifier avec données constructeur GEG Carrier. Valeur saisonnière : h_GEG = ' + EQUIPMENT.h_GEG + ' h/an.',
        sources_used: ['W3'],
        why:
          'Seule la zone de désurchauffe est récupérable à température utile (>55°C). La condensation à 35–45°C est trop basse pour usage direct sans PAC.',
        numerical_result: `Q_cond = ${EQUIPMENT.Q_GEG_frig + EQUIPMENT.P_GEG_comp} kW · Q_désurchauffe = ${result.Q_W3} kW · E = ${result.E_W3} MWh/an`,
      },
    ];

    // ── §3 Parameter traceability ──────────────────────────────────
    const parameters = [
      {
        symbol: 'T_fumées',
        name: 'T° fumées chaudières vapeur',
        value: `${dto.t_flue_in ?? DEFAULTS.t_flue_in}°C`,
        source_type: 'Hypothèse',
        method: 'Typique GN sans économiseur — à confirmer thermocouple type K sur cheminée',
        reliability: 'Moyen',
        sensitivity: 'Si 160°C → Q réduit de 30% (encore rentable, ROI ~3,5 ans)',
      },
      {
        symbol: 'τ_boiler',
        name: 'Charge moyenne chaudières',
        value: `${EQUIPMENT.tau_boiler * 100}%`,
        source_type: 'Hypothèse',
        method: 'Estimé depuis usage : autoclave + EPPI + ECS, production batch pharmaceutique',
        reliability: 'Moyen',
        sensitivity: 'Si 60% → gains ×1,5 (améliore ROI à ~1,8 ans)',
      },
      {
        symbol: 'V̇_CTA',
        name: 'Débit total air extrait CTA',
        value: '75 000 m³/h',
        source_type: 'Hypothèse',
        method: 'ISO 14644 : 20–50 renouvellements/h · Surface ~1 500 m² · H 3m · 40 renouv → 75 000 m³/h (conservateur)',
        reliability: 'Moyen',
        sensitivity: 'Si 50 000 m³/h → E réduit de 33%',
      },
      {
        symbol: 'τ_comp',
        name: 'Taux de charge compresseur',
        value: `${EQUIPMENT.tau_comp * 100}%`,
        source_type: 'Pipeline P2',
        method: 'Extrait rapport d\'audit (p.11) — donnée mesurée via compteur d\'énergie électrique existant',
        reliability: 'Élevé',
        sensitivity: 'Valeur mesurée — robuste',
      },
      {
        symbol: 'h_comp',
        name: 'Heures fonctionnement compresseur',
        value: `${EQUIPMENT.h_comp} h/an`,
        source_type: 'Pipeline P2',
        method: 'Calculé : compteur audit = 19 279h / 2,3 ans = 8 382 h/an ≈ 8 400 h/an',
        reliability: 'Élevé',
        sensitivity: 'Donnée mesurée directe — très fiable',
      },
      {
        symbol: 'h_boiler',
        name: 'Heures fonctionnement chaudières',
        value: `${EQUIPMENT.h_boiler} h/an`,
        source_type: 'Pipeline P2',
        method: 'Extrait audit : fabrication 24h/24, 330 j/an (tableau éclairage)',
        reliability: 'Élevé',
        sensitivity: 'Valeur directe audit — robuste',
      },
      {
        symbol: 'η_WHR',
        name: 'η récupération kit WHR compresseur',
        value: `${(dto.eta_r_comp ?? DEFAULTS.eta_r_comp) * 100}%`,
        source_type: 'Hypothèse',
        method: 'Kit WHR standard constructeur (KOMPRESSOR series). Valeur typique industrie 60–75%.',
        reliability: 'Moyen',
        sensitivity: 'Si 75% → E augmente de +15%',
      },
      {
        symbol: 'η_éch',
        name: 'η échangeur économiseur plaques',
        value: `${(dto.eta_hx ?? DEFAULTS.eta_hx) * 100}%`,
        source_type: 'Standard',
        method: 'Échangeurs à plaques inox ailettés : 0,65–0,85 (ASHRAE HB). Valeur 0,78 retenue (médiane prudente).',
        reliability: 'Élevé',
        sensitivity: 'Variation ±5% sur E',
      },
      {
        symbol: 'P_GN',
        name: 'Prix gaz naturel',
        value: `${dto.p_gn ?? DEFAULTS.p_gn} DT/MWh`,
        source_type: 'Hypothèse',
        method: 'Tarif BP2 estimé STEG/SOTUGAZ — à confirmer avec factures réelles de l\'usine',
        reliability: 'Moyen',
        sensitivity: 'Si +20% → ROI réduit de ~20%',
      },
      {
        symbol: 'P_élec',
        name: 'Prix électricité HTA',
        value: `${dto.p_elec ?? DEFAULTS.p_elec} DT/MWh`,
        source_type: 'Hypothèse',
        method: 'Tarif HTA estimé STEG — à confirmer avec factures réelles',
        reliability: 'Moyen',
        sensitivity: 'Impact sur économies S2 et S3',
      },
      {
        symbol: 'f_CO₂_GN',
        name: 'Facteur émission CO₂ gaz naturel',
        value: `${CONST.f_CO2_GN} kgCO₂/kWh`,
        source_type: 'Standard',
        method: 'GIEC / ADEME — combustion directe gaz naturel (valeur internationale stable)',
        reliability: 'Élevé',
        sensitivity: 'Valeur internationale stable — ne change pas',
      },
      {
        symbol: 'f_CO₂_élec',
        name: 'Facteur émission CO₂ électricité STEG',
        value: `${CONST.f_CO2_elec} kgCO₂/kWh`,
        source_type: 'Standard',
        method: 'Mix tunisien STEG (gaz + pétrole + renouvelables). Valeur 2024.',
        reliability: 'Élevé',
        sensitivity: 'Évolue avec la part du renouvelable — stable à horizon 2–3 ans',
      },
      {
        symbol: 'Cp_vol',
        name: 'Cp volumique fumées GN',
        value: `${CONST.Cp_flue_vol} kJ/(Nm³·K)`,
        source_type: 'Standard',
        method: 'Composition fumées GN typique (CO₂ + H₂O + N₂ + O₂ excès). Littérature thermique industrielle.',
        reliability: 'Élevé',
        sensitivity: 'Variation ±3% selon composition réseau',
      },
      {
        symbol: 'r_stœch',
        name: 'Rapport stœchiométrique GN',
        value: `${CONST.r_stoich_GN} Nm³_fum/Nm³_GN`,
        source_type: 'Standard',
        method: 'Calcul stœchiométrique CH₄ (95% vol GN) + excès air 10%. Standard industrie combustion.',
        reliability: 'Élevé',
        sensitivity: 'Variation ±5% selon composition réseau STEG',
      },
    ];

    // ── §4 MCDA scoring framework ──────────────────────────────────
    const scoring = {
      weights: {
        C1_energy:      WEIGHTS.C1_energy,
        C2_co2:         WEIGHTS.C2_co2,
        C3_feasibility: WEIGHTS.C3_feasibility,
        C4_capex:       WEIGHTS.C4_capex,
        C5_roi:         WEIGHTS.C5_roi,
      },
      formula: `Score_total = ${WEIGHTS.C1_energy}×C1 + ${WEIGHTS.C2_co2}×C2 + ${WEIGHTS.C3_feasibility}×C3 + ${WEIGHTS.C4_capex}×C4 + ${WEIGHTS.C5_roi}×C5`,
      criteria: {
        C1: {
          name: 'Potentiel énergétique récupérable',
          weight: WEIGHTS.C1_energy,
          unit: 'MWh/an',
          rationale: 'Critère dominant car objectif principal du WHR.',
          scales: [
            { range_min: 0,   range_max: 50,       score_min: 1, score_max: 2, description: 'Impact marginal, ne justifie pas un projet dédié (ex. condensats W8 seuls)' },
            { range_min: 50,  range_max: 150,      score_min: 3, score_max: 4, description: 'Viable si technologie simple et puits local disponible' },
            { range_min: 150, range_max: 300,      score_min: 5, score_max: 6, description: 'Intéressant, correspond à un équipement auxiliaire significatif' },
            { range_min: 300, range_max: 500,      score_min: 7, score_max: 8, description: 'Prioritaire, réduction notable de la facture énergétique' },
            { range_min: 500, range_max: Infinity,  score_min: 9, score_max: 10, description: 'Impact majeur sur bilan site, technologie justifiée même à CAPEX élevé' },
          ],
        },
        C2: {
          name: 'Réduction CO₂ évitées',
          weight: WEIGHTS.C2_co2,
          unit: 'tCO₂/an',
          rationale: 'Corrélé à C1 mais différencié si source électrique vs GN.',
          scales: [
            { range_min: 0,   range_max: 10,       score_min: 1, score_max: 2, description: 'Impact négligeable sur bilan carbone site' },
            { range_min: 10,  range_max: 30,       score_min: 3, score_max: 4, description: 'Contribution modeste, pertinent si couplé à d\'autres mesures' },
            { range_min: 30,  range_max: 60,       score_min: 5, score_max: 6, description: 'Contribution significative, reportable dans bilan GES Scope 1' },
            { range_min: 60,  range_max: 100,      score_min: 7, score_max: 8, description: 'Réduction importante, visible dans reporting RSE / ISO 50001' },
            { range_min: 100, range_max: Infinity,  score_min: 9, score_max: 10, description: 'Impact majeur, potentiellement éligible à mécanismes de crédit carbone' },
          ],
        },
        C3: {
          name: 'Faisabilité technique & GMP',
          weight: WEIGHTS.C3_feasibility,
          unit: 'score',
          rationale: 'Critique en pharma — zones classées = intégration complexe, validation réglementaire.',
          scales: [
            { range_min: 1, range_max: 2, score_min: 1, score_max: 2, description: 'Zone de production classée — risque contamination, validation HVAC, arrêt production probable' },
            { range_min: 3, range_max: 4, score_min: 3, score_max: 4, description: 'Proximité zone classée — travaux lourds, interfaces systèmes qualifiés, pré-qualification EQ/OQ/PQ' },
            { range_min: 5, range_max: 6, score_min: 5, score_max: 6, description: 'Zone technique adjacente — travaux modérés, quelques interfaces qualifiées' },
            { range_min: 7, range_max: 8, score_min: 7, score_max: 8, description: 'Zone technique dédiée — impact minime sur production' },
            { range_min: 9, range_max: 10, score_min: 9, score_max: 10, description: 'Installation isolée (chaufferie, local compresseur) — 0 impact production, TRL 9, sans arrêt' },
          ],
        },
        C4: {
          name: 'Niveau d\'investissement CAPEX (score inverse)',
          weight: WEIGHTS.C4_capex,
          unit: 'DT',
          rationale: 'ROI 3–5 ans acceptable en pharma si C1/C2/C3 élevés.',
          scales: [
            { range_min: 200000, range_max: Infinity,  score_min: 1, score_max: 2, description: 'CAPEX > 200 kDT — validation majeur, processus approbation long' },
            { range_min: 100000, range_max: 200000,   score_min: 3, score_max: 4, description: '100–200 kDT — investissement significatif, business case détaillé requis' },
            { range_min: 50000,  range_max: 100000,   score_min: 5, score_max: 6, description: '50–100 kDT — investissement modéré, décision locale possible' },
            { range_min: 20000,  range_max: 50000,    score_min: 7, score_max: 8, description: '20–50 kDT — faible CAPEX, décision rapide, budget maintenance' },
            { range_min: 0,      range_max: 20000,    score_min: 9, score_max: 10, description: '< 20 kDT — très faible CAPEX, quick win, approbation immédiate probable' },
          ],
        },
        C5: {
          name: 'Retour sur investissement (payback)',
          weight: WEIGHTS.C5_roi,
          unit: 'ans',
          rationale: 'Pondération modérée car le ROI découle de C1+C4.',
          scales: [
            { range_min: 5,   range_max: Infinity, score_min: 1, score_max: 2, description: 'Payback > 5 ans — acceptable si C1 très élevé ou obligation réglementaire' },
            { range_min: 3,   range_max: 5,        score_min: 3, score_max: 4, description: '3–5 ans — acceptable en pharma si C1/C2/C3 ≥ 7' },
            { range_min: 2,   range_max: 3,        score_min: 5, score_max: 6, description: '2–3 ans — attractif, aligné sur critères d\'investissement standard industrie' },
            { range_min: 1,   range_max: 2,        score_min: 7, score_max: 8, description: '1–2 ans — très attractif, priorité haute' },
            { range_min: 0,   range_max: 1,        score_min: 9, score_max: 10, description: '< 1 an — quick win immédiat, décision sans étude complémentaire' },
          ],
        },
      },
      // Scored ranking from live calculation
      ranking: [
        {
          rank: 1,
          source: 'W3',
          score: result.scores.W3.total,
          breakdown: result.scores.W3,
          justification: `${result.E_W3} MWh/an — énergie dominante compense T° basse. Installation sur GEG (zone technique). Score énergie élevé compense C3=7.`,
        },
        {
          rank: 2,
          source: 'W2',
          score: result.scores.W2.total,
          breakdown: result.scores.W2,
          justification: `Quick win : ROI ${result.roi_s2.toFixed(1)} an, CAPEX ${capex_s2.toLocaleString()} DT, local compresseur isolé. C3=9, C4=9, C5=10.`,
        },
        {
          rank: 3,
          source: 'W1',
          score: result.scores.W1.total,
          breakdown: result.scores.W1,
          justification: `Technologie TRL9 éprouvée, installation chaufferie (0 impact GMP, C3=10). Énergie modeste ${result.E_W1} MWh compensée par faisabilité maximale.`,
        },
      ],
      sensitivity_analysis: {
        description: 'Si le décideur priorise le ROI (w₅ : 0,15 → 0,30), W2 compresseur passe en #1. Démontre la nature décisionnelle interactive du modèle.',
        alternative_weights: { C1: 0.25, C2: 0.15, C3: 0.15, C4: 0.15, C5: 0.30 },
        impact: 'W2 score estimé ~8,4 avec poids ROI élevé — classement inversé W2>#1, W3>#2.',
      },
    };

    // ── §5 Scenario ROI brackets (best / base / conservative) ─────
    const scenarioBrackets = scenariosData.map((sc) => {
      const capex = sc.capex_dt;
      return {
        ...sc,
        roi_brackets: {
          conservative: capex > 0 ? +(capex / (sc.savings_dt * 0.80)).toFixed(2) : null,
          base:         sc.roi_yr,
          best:         capex > 0 ? +(capex / (sc.savings_dt * 1.20)).toFixed(2) : null,
        },
        note_conservative: 'Économies réelles −20% (tarifs bas + hypothèses pessimistes)',
        note_best:         'Économies réelles +20% (tarifs élevés + charge opérationnelle optimale)',
      };
    });

    // ── §6 Data architecture ───────────────────────────────────────
    const dataArchitecture = {
      iot_part1: [
        { sensor: 'Thermocouple cheminée chaudières', field: 't_flue_in', unit: '°C · continu', purpose: 'Valide T_fumées (hypothèse 190°C) — calcule Q_fumées temps réel via EQ-3' },
        { sensor: 'Compteur énergie compresseur', field: 'P_comp_meas', unit: 'kW · horaire', purpose: 'Confirme τ_charge=39% — calcule Q_compresseur récupérable via EQ-4' },
        { sensor: 'T° entrée/sortie condenseurs GEG', field: 't_GEG_in / t_GEG_out', unit: '°C · continu', purpose: 'ΔT réel pour Q_désurchauffe — valide hypothèse 35–45°C' },
        { sensor: 'Sondes T° air extrait CTA', field: 't_cta_extract', unit: '°C · continu', purpose: 'Valide 22°C et débit thermique air extrait' },
        { sensor: 'Compteur GN divisionnaire par chaudière', field: 'v_gn_flow', unit: 'Nm³/h · horaire', purpose: 'Alimentation directe calcul EQ-3 si branché' },
        { sensor: 'T° eau bâche alimentaire', field: 't_feedwater', unit: '°C · continu', purpose: 'Baseline calcul gain économiseur (actuellement ~80°C)' },
      ],
      pipeline_part2: [
        { source: 'Rapport d\'audit énergétique 2024–2025', type: 'Document · one-time', purpose: 'Puissances installées, taux de charge, heures fonctionnement — base de toutes les hypothèses P2' },
        { source: 'Compteur horaire compresseur (cumul)', type: 'h · cumulé', purpose: '19 279 h / 2,3 ans → 8 400 h/an — base calcul S2' },
        { source: 'Planning production batch', type: 'j/an · statique', purpose: '330 j/an × 24h/24 → 7 920 h/an chaudières' },
        { source: 'Puissances nominales équipements (plaques)', type: 'kW · statique', purpose: `GEG ${EQUIPMENT.Q_GEG_frig} kW frig, chaudières ${EQUIPMENT.P_boiler_nom} kW, compresseur ${EQUIPMENT.P_comp_nom} kW` },
        { source: 'Mesure Tri-gén (eau chaude + absorption)', type: 'kWh/h · mesuré', purpose: '419 kWh/h mesurés vs 1 270 kW installés → gap tri-gen 851 kW' },
      ],
      user_inputs: [
        { param: 'Prix gaz naturel', field: 'p_gn', unit: 'DT/MWh', default: dto.p_gn ?? DEFAULTS.p_gn, purpose: 'Impact direct sur économies S1 (chaudières GN)' },
        { param: 'Prix électricité HTA', field: 'p_elec', unit: 'DT/MWh', default: dto.p_elec ?? DEFAULTS.p_elec, purpose: 'Impact économies S2 (compresseur) et S3 (GEG)' },
        { param: 'T° fumées chaudières mesurée', field: 't_flue_in', unit: '°C', default: dto.t_flue_in ?? DEFAULTS.t_flue_in, purpose: 'Remplace hypothèse 190°C dès que thermocouple disponible — recalcul automatique Q_W1' },
        { param: 'η échangeur à plaques', field: 'eta_hx', unit: '—', default: dto.eta_hx ?? DEFAULTS.eta_hx, purpose: 'Sensibilité ±5% sur E_W1' },
        { param: 'η récupération kit WHR', field: 'eta_r_comp', unit: '—', default: dto.eta_r_comp ?? DEFAULTS.eta_r_comp, purpose: 'Confirmer avec constructeur (plage 0,60–0,75)' },
        { param: 'CAPEX S1 / S2 / S3', field: 'capex_s1, capex_s2, capex_s3', unit: 'DT', default: `${capex_s1} / ${capex_s2} / ${capex_s3}`, purpose: 'Affiner avec devis réels — impact direct sur ROI' },
      ],
    };

    // ── §7 KPI definitions + live values ──────────────────────────
    const kpis = [
      {
        id: 'E_annual',
        name: 'Énergie récupérable annuelle',
        formula: 'E_i [MWh/an] = Q_i [kW] × h_fonctionnement / 1 000',
        equations_ref: ['EQ-1', 'EQ-2', 'EQ-3', 'EQ-4', 'EQ-5'],
        visualization: 'Barres horizontales comparatives (sources W1–W8) + KPI card total',
        values: { E_W1: result.E_W1, E_W2: result.E_W2, E_W3: result.E_W3, E_W5: result.E_W5, E_total: result.E_total },
      },
      {
        id: 'CO2_avoided',
        name: 'CO₂ évité annuel',
        formula: 'CO₂_évité [tCO₂/an] = E_récup [MWh] × f_CO₂ [kgCO₂/kWh] / 1 000',
        factors: { GN: `${CONST.f_CO2_GN} kgCO₂/kWh`, elec: `${CONST.f_CO2_elec} kgCO₂/kWh (mix STEG)` },
        note: 'f_CO₂ choisi selon ce que la chaleur récupérée remplace (GN pour S1, élec pour S2/S3)',
        visualization: 'KPI card + graphique CO₂ actuel vs CO₂ avec scénarios (side-by-side)',
        values: { co2_W1: result.co2_W1, co2_W2: result.co2_W2, co2_W3: result.co2_W3, co2_total: result.co2_total },
      },
      {
        id: 'savings',
        name: 'Économies financières annuelles',
        formula: 'Éco [DT/an] = E_récup [MWh/an] × P_énergie [DT/MWh]',
        note: 'P_énergie = P_GN si substitution gaz (S1), P_élec si substitution électrique (S2, S3)',
        visualization: 'Waterfall chart (S1 + S2 + S3 → Total) · affichage DT/an et DT/j',
        values: {
          savings_s1: result.savings_s1,
          savings_s2: result.savings_s2,
          savings_s3: result.savings_s3,
          savings_total: result.savings_total,
          savings_per_day: Math.round(result.savings_total / 365),
        },
      },
      {
        id: 'roi',
        name: 'Retour sur investissement (ROI)',
        formula: 'ROI_simple [ans] = CAPEX [DT] / Éco_annuelle [DT/an] · Cum(t) = Éco×t − CAPEX',
        note: 'ROI_pondéré_combiné = ΣCAPEX / ΣÉco. Break-even quand Cum(t) = 0.',
        visualization: 'Courbes ROI sur 12 ans par scénario + point break-even visuel',
        values: {
          roi_s1: result.roi_s1,
          roi_s2: result.roi_s2,
          roi_s3: result.roi_s3,
          roi_weighted: result.roi_weighted,
          capex_total: capex_total,
        },
      },
      {
        id: 'mcda_score',
        name: 'Score de priorisation multicritères',
        formula: 'Score = Σ(w_i × s_i), Σw_i = 1, s_i ∈ [1,10]',
        note: 'Score /10 par source. Ranking dynamique — modifié par les poids w_i (sliders dashboard).',
        visualization: 'Radar chart (5 critères × 3 sources top) + tableau ranking avec barres de progression',
        values: { scores: result.scores },
      },
      {
        id: 'hrr',
        name: 'Taux d\'exploitation (Heat Recovery Rate)',
        formula: 'HRR [%] = E_récupérée_effective / E_récupérable_estimée × 100',
        note: 'KPI opérationnel live depuis IoT Part 1. Alerte si HRR < 80% du prévu → anomalie équipement WHR.',
        visualization: 'Jauge circulaire live + historique journalier (ligne temporelle)',
        values: null, // populated from IoT in real-time at /whr/calculate with sensors
      },
      {
        id: 'co2_differential',
        name: 'Bilan CO₂ différentiel (actuel vs scénarios)',
        formula: 'ΔCO₂ = CO₂_actuel − CO₂_évité_S1 − CO₂_évité_S2 − CO₂_évité_S3',
        note: `Affichage côte à côte : situation actuelle vs post-implémentation. ${result.co2_total} tCO₂/an évitées si S1+S2+S3 déployés.`,
        visualization: 'Barres empilées (Scope 1 actuel vs cible) — couleur verte = évité',
        values: { total_avoided_t_yr: result.co2_total },
      },
    ];

    // ── §8 Mathematical model summary ─────────────────────────────
    const mathModel = {
      A_heat_estimation: [
        { eq: 'Q = ṁ·Cp·ΔT·η',             description: 'Chaleur sensible fluides monophasiques (W1 fumées, W2 compresseur, W4 air CTA) — 1er principe régime permanent', ref: 'EQ-1' },
        { eq: 'Q_purge = ṁ_purge·h_fg',    description: `Chaleur purges vapeur — enthalpie vaporisation ${CONST.h_fg_5bar} kJ/kg à 5 bars, 152°C`, ref: 'EQ-2' },
        { eq: 'Q_fum = V̇·Cp_vol·ΔT·η',    description: `Méthode volumique fumées — débit dérivé compteur GN × rapport stœchio. ${CONST.r_stoich_GN} Nm³/Nm³`, ref: 'EQ-3' },
        { eq: 'Q_comp = P_élec·τ·η_p·η_r', description: 'Chaleur compresseur — bilan boîte noire (80% pertes × efficacité récupération)', ref: 'EQ-4' },
        { eq: 'Q_désurch = 12%·Q_cond',     description: 'Chaleur désurchauffe GEG — fraction vapeur surchauffée avant condensation R134a (10–15%)', ref: 'EQ-5' },
        { eq: 'Q_cond = Q_frig + P_GEG',    description: `Chaleur totale condenseur — bilan 1er principe cycle frig : ${EQUIPMENT.Q_GEG_frig}+${EQUIPMENT.P_GEG_comp}=${EQUIPMENT.Q_GEG_frig + EQUIPMENT.P_GEG_comp} kW`, ref: 'derived' },
        { eq: 'V̇_GN = P_chaud/(PCI·η)',    description: `Débit vol. GN = ${EQUIPMENT.P_boiler_nom}×${EQUIPMENT.tau_boiler}/${EQUIPMENT.eta_boiler}/${CONST.PCI_GN}×3600 ≈ 278 Nm³/h`, ref: 'derived' },
        { eq: 'E = Q·h/1000',               description: 'Énergie annuelle [MWh] = puissance [kW] × heures fonctionnement / 1000', ref: 'derived' },
      ],
      B_co2_reduction: [
        { eq: 'CO₂ = E·f_CO₂·1000',   description: `CO₂ évité [kg/an]. f_CO₂(GN)=${CONST.f_CO2_GN} ; f_CO₂(élec)=${CONST.f_CO2_elec} kgCO₂/kWh`, ref: 'standard' },
        { eq: 'ΔCO₂ = CO₂_base−CO₂_WHR', description: 'Réduction nette — CO₂ actuel moins CO₂ avec récupération (énergie substituée)', ref: 'derived' },
      ],
      C_roi: [
        { eq: 'Éco = E·P_énergie',               description: 'Économie annuelle [DT/an] = énergie récupérée × prix énergie substituée', ref: 'derived' },
        { eq: 'ROI_simple = CAPEX/Éco',           description: 'Payback simple [ans] — analyse préliminaire (sans actualisation)', ref: 'derived' },
        { eq: `ROI_pondéré = ΣCAPEX/ΣÉco`,        description: `ROI global 3 scénarios : ${capex_total}/${result.savings_total} = ${result.roi_weighted} ans`, ref: 'derived' },
        { eq: 'Cum(t) = Éco·t − CAPEX',          description: 'Cash-flow cumulé [DT] en année t — break-even quand Cum(t)=0', ref: 'derived' },
      ],
      D_scoring: [
        { eq: 'Score = Σ(w_i·s_i)',              description: `Somme pondérée. Σw_i=1. s_i ∈ [1,10] définis par barème physique §4.`, ref: 'MCDA' },
        { eq: `w = [${Object.values(WEIGHTS).join('; ')}]`, description: '[C1 énergie; C2 CO₂; C3 faisabilité; C4 invest.; C5 ROI]. Modifiable par utilisateur en dashboard.', ref: 'MCDA' },
        { eq: 'HRR = E_eff/E_est×100%',          description: 'Heat Recovery Rate — KPI opérationnel. Alerte si HRR < 80% du potentiel calculé.', ref: 'derived' },
      ],
    };

    // ── Pitch message (§8 conclusion) ──────────────────────────────
    const pitchMessage =
      `Cette usine gaspille aujourd'hui environ ${triGenGap.gap_kw} kW de chaleur ` +
      `non récupérée dans la Tri-génération seule, et l'ensemble des sources identifiées ` +
      `représente ${result.E_total} MWh/an récupérables — soit l'équivalent de ` +
      `${result.co2_total} tonnes de CO₂ évitées par an, pour un investissement total de ` +
      `${capex_total.toLocaleString()} DT et un retour en ${result.roi_weighted} ans. ` +
      `C'est de la valeur dormante, convertible en économies concrètes avec des technologies ` +
      `TRL 9, installables sans arrêt de production.`;

    return {
      // Dynamic (recalculated from user params)
      result,
      scenarios:      scenarioBrackets,
      roi_curves:     roiCurves,
      tri_gen_gap:    triGenGap,
      // Framework metadata (§1–§8)
      sources,
      equations,
      parameters,
      scoring,
      data_architecture: dataArchitecture,
      kpis,
      math_model:     mathModel,
      pitch_message:  pitchMessage,
    };
  }
}
