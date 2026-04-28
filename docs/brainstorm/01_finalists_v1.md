# NRTF 3.0 — Hack-E Strategy & Brainstorm (v1)

> **Event:** National Re-Tech Fusion 3.0 (Hack-E hackathon)
> **When:** 1–3 May 2026, 24-hour hackathon block
> **Where:** Hotel Rivera, Sousse, Tunisia
> **Organizers:** IEEE PES × PELS Joint Student Chapter @ INSAT
> **Theme (leaked & confirmed by event DNA):** Energy optimization (renewables + power electronics + AI)
> **Prize pool:** 10,000+ TND
> **Goal:** First place.
> **Site:** https://nrtf-three.vercel.app/

---

## Our team — and why we have an unfair advantage

Five people: 2 software/AI (Talel + roommate), 1 IIA (industrial automation/embedded), 2 chemical/biological engineering. **Most teams in the room will be CS-only.** Our moat is the chem/bio + automation combo — we can credibly demo *real chemistry/biology phenomena instrumented with real sensors and analyzed with AI*. That moat dictates strategy: avoid pure-software ideas; pick something with a physical demo only we can pull off.

**Hardware budget:** ESP32 / Arduino / Raspberry Pi / basic sensors. No exotic equipment. Web app stays on localhost.

---

## What the judges will weigh (inferred — IEEE PES/PELS academic jury)

1. **Working hardware demo** — even a breadboard with a relay beats slides
2. **Technical depth** — show one equation, one topology, one block diagram per slide
3. **Local Tunisia relevance** — STEG, ANME, PROSOL, Plan Solaire 2030 vocabulary
4. **Power-electronics or grid hook** — name-drop IEEE 2030, IEC 61850, or a PES/PELS focus area
5. **Quantified savings** in TND or millimes (not USD)
6. **Pitch culture:** open in French, technical slides in English, one Tunisian-Arabic phrase in the hook. Address jury formally.

---

## Tunisia context cheatsheet (use these in the pitch deck)

- **STEG tariff:** progressive brackets; tranche 1 (0–200 kWh/mo) = ~162 millimes/kWh, >500 kWh = 400+ millimes. **Tranche cliff** = top complaint on Tunisian Twitter.
- **STEG cost basis:** ~95% gas-fired, average production cost ~472 millimes/kWh — every retail kWh is sold at a loss, Treasury subsidizes.
- **Peak demand 2024:** 4.6 GW vs 5.94 GW installed — chronic summer brownouts in Sfax/Gabès/Sousse industrial belts.
- **Smart meters:** STEG rollout (Sia Partners + Talan) in progress, Sfax pilot — most homes still mechanical → huge whitespace.
- **PROSOL Elec économique** (launched Nov 2025): 30% rebate via FNME, free STEG inverter, 5-yr loan up to 3,000 TND/kW for residential PV.
- **Hydrogen:** national strategy targets 8.3 Mt/yr by 2050 (mostly export). TE H2, ACWA Power, SoutH2 corridor, ELMED interconnector to Italy starting construction Q1 2026.
- **Renewables share April 2026:** ~6% (787 MW installed) vs target 35% by 2030 — massive gap = massive opportunity narrative.
- **Pain points to weaponize:**
  - Summer blackouts → cold-chain losses for SMEs
  - Diesel genset dependency in hotels/clinics → fuel subsidy phase-out under IMF pressure
  - Tranche cliff → unfair billing complaints
  - 6–12 month PV connection delays at STEG
  - <50 EV chargers nationwide
  - No demand-response market for residential

---

## Top 3 finalist ideas (ranked, all hit the energy theme + our moat)

### 🏆 #1 — H2-Sentinel + Electrolyzer Efficiency Twin

> **One-liner:** A hobby PEM electrolyzer cell instrumented to monitor green-hydrogen production efficiency in real-time, with leak detection and an AI model that flags membrane degradation from V/I/T patterns.

**Why this wins NRTF 3.0 specifically:**
- Hydrogen is THE 2026 PES/PELS sponsor topic (TE H2, ACWA Power, SoutH2 corridor are headline news here).
- Tunisia just signed massive H2 export deals — pitching "domestic value capture in green H2 monitoring" hits every judge bias.
- Dual demo (efficiency + safety) gives **two wow moments** in a 5-minute pitch.

**24h MVP:**
- Hobby PEM electrolyzer cell + variable PSU through a controlled MOSFET
- INA219 logs V/I; MQ-8 sensor in headspace catches H2 leaks
- Water-displacement cylinder for ground-truth H2 flow
- Web dashboard: live polarization curve (I–V), Faradaic efficiency %, leak alarm with auto PSU cut-off
- ML model: trained on synthetic + real V/I/T sweeps, predicts membrane health

**Hardware (~70 TND total):**
- Hobby PEM cell (~30 USD on AliExpress — **MUST ORDER BY APRIL 17**)
- ESP32, INA219, MQ-8 hydrogen sensor, MOSFET, distilled water, graduated cylinder

**Demo killer (30 seconds):** Open the cell housing slightly → MQ-8 alarm fires within 10s → dashboard auto-cuts the PSU → swap distilled water for tap water → efficiency drops live in front of judges.

**Role split:**
- **Chem/bio #1:** electrolysis chemistry slide, overpotential explanation, water purity story
- **Chem/bio #2:** H2 storage + safety (TWA, LEL), pitch the "Tunisia H2 export" narrative
- **IIA:** PEM cell wiring, PSU control loop, INA219 + MQ-8 ESP32 firmware
- **Talel (SW/AI):** dashboard + ML efficiency predictor + pitch deck
- **Roommate (SW/AI):** data pipeline, time-series storage, MCP server wrapping the live data for an LLM "ask the electrolyzer" demo bonus

**Risk:** Sourcing the PEM cell. **Action: order it this week.** Backup plan: simulate the cell with a Python physics model and demo the dashboard alone (defensibility drops 1 point).

---

### 🥈 #2 — Thermal Runaway Sentinel (Battery Safety)

> **One-liner:** A Li-ion safety system that predicts thermal runaway 60–120s before venting, using only voltage + skin-temp drift, deployed on a $5 ESP32 — and trips a relay to disconnect the cell before it ignites.

**Why this wins:**
- Battery safety is the #1 PES/PELS conversation in 2026 (EV fires, BESS incidents).
- Visceral, theatrical demo: temperature climbs live, alert fires, relay clicks, "we just saved the building."
- Cross-team showcase: chem-engs explain SEI breakdown, IIA builds the rig, AI does CUSUM + tiny LSTM.

**24h MVP:**
- Heater pad on a sacrificial LiPo, NTC thermistor + voltage logging at 100ms
- CUSUM detector (statistical change-point) + threshold + tiny LSTM trained on public TR datasets
- Auto-disconnect via relay; web dashboard shows the prediction confidence band climbing

**Hardware (~40 TND):**
- 2x sacrificial old LiPo cells, heater pad (12V resistive), NTC, ESP32, relay module, fire bucket + sand + CO₂ extinguisher

**Demo killer:** Press a button on the dashboard to start the heater. Temperature climbs. At T+45s the prediction band crosses the threshold, alarm sounds, relay opens with an audible click, dashboard reads "BUILDING SAVED — venting prevented at 87°C, 38s before predicted thermal runaway."

**Role split:**
- **Chem/bio #1+2:** SEI breakdown chemistry, the "what happens at 90°C" story, safety procedures
- **IIA:** rig design (safe abuse setup), relay/heater control, thermistor calibration
- **Talel:** ML model (CUSUM + LSTM), dashboard
- **Roommate:** data logging + cloud-style "fleet dashboard" mockup ("imagine 100 cells")

**Risk:** Safety. Get organizer permission, do all heating on a metal pan over sand. If banned, fall back to *simulated* runaway with a heater + thermistor on a non-battery heat source — same model, no fire risk. Slightly less dramatic but still compelling.

---

### 🥉 #3 — Greenhouse Co-Optimizer (RL agent for energy + yield)

> **One-liner:** A miniature greenhouse where a reinforcement-learning agent co-optimizes heating, ventilation, and shading to minimize energy while preserving crop transpiration — directly relevant to Tunisia's geothermal-greenhouse industry.

**Why this wins:**
- Tunisia operates ~130 ha of geothermal-heated greenhouses (Tozeur, Kebili) — *direct local relevance*.
- Best team-fit play: bio students bring Penman-Monteith / VPD models, IIA builds actuators, AI does RL.
- Two-greenhouse side-by-side demo (manual vs RL) is unforgettable.

**24h MVP:**
- Two clear plastic boxes, identical setup. Sensors: DHT22 (T/RH), BH1750 (lux). Actuators: Peltier or resistive heater, 12V fan, servo-driven shade.
- RL agent (or rule-based MPC fallback) pre-trained in a 2-hour Gym sim of greenhouse dynamics
- Mock STEG time-of-use prices feed the cost function
- Live dashboard with Wattmeters showing kWh used by each box

**Hardware (~80 TND):**
- 2 plastic boxes, DHT22 ×2, BH1750 ×2, 2 fans, 2 small heaters, 2 servos, ESP32 ×2, 2 power meters

**Demo killer:** Run both side-by-side for 30 min during pitch prep; play the time-lapse during the pitch and show RL box used 38% less energy while keeping VPD in the safe band.

**Role split:**
- **Chem/bio #1:** Penman-Monteith / transpiration model
- **Chem/bio #2:** crop physiology, VPD safe-band, Tunisian tomato/strawberry context
- **IIA:** actuator wiring, control loops, sensor calibration
- **Talel:** RL training + simulator, dashboard
- **Roommate:** data pipeline, "scale to 100 greenhouses" cloud mockup

**Risk:** RL training in 24h is shaky. Fallback: hand-tuned MPC ("near-optimal control") — judges won't penalize.

---

## Strong honorable mentions (keep as fallbacks)

| # | Idea | Why keep it |
|---|------|-------------|
| 4 | **EIS-Lite (battery SoH)** | Pairs with #2 to form a "BatterySafe" suite if we want a portfolio play |
| 5 | **BiogasYieldGPT** (photo → CH₄ potential) | Pure chem-eng moat, hyper-local (organic waste) |
| 6 | **Tranche-Aware Energy Coach** | Software-only, zero hardware risk — emergency fallback if everything else fails |
| 7 | **Solar Pump Scheduler** | Highest "hackability" score (5/5), agriculture angle |
| 8 | **Pinch-as-a-Service** (industrial energy) | No-hardware industrial play; pairs well with #3 as "ag + industry" portfolio |

---

## Decision framework — pick the project Friday April 24 evening

Score each finalist 1–5 on:
1. Can we get the **critical hardware** by April 30? (PEM cell for #1, sacrificial LiPo for #2, plastic boxes for #3)
2. Will the chem/bio teammates be **available + comfortable** with the chemistry?
3. Is the **demo failure mode survivable** (i.e., even if it breaks, can we still pitch credibly)?
4. Does it **shorten our pitch deck** (one sentence problem, one diagram, one demo)?

Pick the highest-total. If tied, pick the one with the *bigger* visual moment.

---

## Pre-hackathon checklist (do this WEEK of April 24–30)

- [ ] **Order PEM electrolyzer cell** (~30 USD AliExpress — lead time risk)
- [ ] **Order MQ-8 H2 sensor** (locally if possible)
- [ ] Confirm with organizers: can we **pre-build hardware** before clock starts? (huge for fermentation/MFC ideas)
- [ ] Confirm with organizers: **demo location** — can we run live hardware on stage? Power outlets? Wi-Fi for dashboard?
- [ ] Get **2 sacrificial LiPo cells** (old phone batteries from a repair shop — free)
- [ ] Borrow from INSAT lab: clamp meter, multimeter, soldering iron, helping hands
- [ ] **Pitch deck template** (10 slides max, French intro + English technical)
- [ ] Set up **GitHub org** for the team, agree on stack (Python + FastAPI + Next.js or Streamlit)
- [ ] **Sleep schedule** — at least one teammate rested at hour 18 to handle the morning pitch
- [ ] **Outfit** — smart-casual (no t-shirts for the pitch)

---

## Pitch tactics (verbatim usable)

**Opening hook (30 sec):**
> "En Tunisie, en 2024, le pic de demande électrique a frôlé les 4.6 gigawatts contre 5.94 gigawatts installés. La marge de réserve est devenue dangereusement mince — et chaque été, mes parents à [ville] perdent l'électricité pendant des heures. *Aujourd'hui, on présente [PROJECT NAME] — [ONE LINE].*"

**Technical depth slide (must-haves):**
- One topology block diagram (the IIA member draws it)
- One equation (Faradaic efficiency, or VPD, or EIS impedance — depending on project)
- One performance number with a Tunisian unit (TND/kWh saved, kg CO₂ avoided, blackout minutes avoided)

**Closing (30 sec):**
> "Ce projet s'aligne directement avec le Plan Solaire Tunisien 2030 et les objectifs de l'ANME. Avec PROSOL Elec et la stratégie hydrogène nationale, [PROJECT NAME] peut être déployé dès 2027 chez [STEG / les hôteliers / les agriculteurs]. Nous remercions le jury — vos questions ?"

**Name-drop bingo:** STEG, ANME, FNME, PROSOL Elec, Plan Solaire 2030, IEEE 2030 (smart grid interop), CRTEn, ENIT.

---

## Open questions for the team meeting

1. Can the chem/bio teammates **commit to building a small physical setup** (greenhouse box, heater rig, electrolyzer) on Day 1 of the hackathon?
2. Does the IIA teammate already own / can borrow: ESP32 ×3, breadboard, jumper wires, soldering iron, INA219, MAX6675?
3. Are we OK with a **safety-themed demo** (#2 Thermal Runaway) or do we want to play it safer with #1 H2 or #3 Greenhouse?
4. Who is the **designated pitcher** — the person who will speak French + English fluently for 5 minutes under pressure?
5. Sleep strategy: full team pulling 24h, or shifts?

---

## Appendix — full 12-idea long-list (for reference)

1. **EIS-Lite** — Li-ion SoH from cheap impedance features (17 pts)
2. **Thermal Runaway Sentinel** — battery safety with V+T (17 pts)
3. **BioWatt** — MFC monitoring + MPPT (15 pts)
4. **BiogasYieldGPT** — photo-to-CH₄ predictor (16 pts)
5. **H2-Sentinel** — electrolyzer efficiency twin (17 pts)
6. **Distillation Twin** — bench column digital twin (13 pts)
7. **Greenhouse Co-Optimizer** — RL energy + yield (17 pts)
8. **Solar Pump Scheduler** — irrigation with PV forecasting (17 pts)
9. **Pinch-as-a-Service** — industrial energy intelligence (16 pts)
10. **CO₂ Mineralization Monitor** — accelerated carbonation (14 pts)
11. **Bioethanol Optimizer** — fermentation soft-sensor (14 pts)
12. **Pyrolysis-from-Photos** — olive pomace energy (16 pts)

Scoring: hackability + sponsor appeal + defensibility vs CS teams + Tunisia relevance, each 1–5.

---

*Document v1 — generated April 24, 2026. Iterate before April 30 team meeting.*
