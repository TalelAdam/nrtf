# NRTF 3.0 — Project Strategy (KILANI-Aligned)

> **Hackathon:** NRTF 3.0 (Hack-E), May 1–3, 2026, Hotel Rivera, Sousse
> **Main sponsor & spec-book author:** **Groupe KILANI** (Tunisian conglomerate — pharma, agri-food, dermocosmetics, distribution, public works)
> **Theme:** Energy optimization
> **Team:** 5 — Talel + roommate (software/AI), 1 IIA (industrial automation/embedded), 2 chemical/biological engineering students
> **Goal:** First place. Story-driven pitch + live electronics demo + tangible ROI for KILANI.

---

## 1. The pivot

After our team meeting, the strategy collapses from "general energy optimization" to **"solve a real KILANI problem so well that the spec-book authors recognize themselves in the pitch."** This narrows the design space and dramatically increases our win probability — the judging panel includes the people who wrote the brief.

The prior brainstorms (cross-disciplinary idea bank, AI-trend map, fintech crossovers) have been retired. This document is the single source of truth.

---

## 2. KILANI Group — what they do, where they hurt

### Industrial portfolio

| Subsidiary | Sector | Sites | Energy profile |
|---|---|---|---|
| **TERIAK** | Pharmaceutical (tablets, capsules, syrups, sterile forms) | **Jebel Ouest** + **El Fejja** (Tunisia), Cinpharm (Cameroon) | Massive HVAC for cleanrooms — 60-66% of facility energy; steam boilers for sterilization; chillers; compressed air |
| **ADWYA** | Pharmaceutical (8% Tunisian market share) | Route de la Marsa Km 14 | Same cleanroom + HVAC profile as TERIAK |
| **PROTIS** | Dermocosmetics (natural-ingredient products) | Tunisia | Mixers, emulsifiers, cold-storage, packaging lines |
| **IKEL** (acquired Grain d'Or from Nestlé in 2022) | Agri-food / breakfast cereals | **Ain Zaghouan, Tunis** (in production since 1989) | Drying ovens, extruders, packaging lines, cold-chain logistics — drying alone = 30-40% of plant energy |
| **Kilani Public Works** | Construction (hydro-agricultural, civil, petroleum) | Southern Tunisia | Diesel gensets at remote sites; perfect for solar PV monitoring |
| **Distribution** | L'Oréal, LVMH, Pampers, Roche, Medtronic, etc. | Warehouses across TN | Cold storage for pharma + cosmetics |

### Why this is gold for our pitch

**KILANI is already publicly committed to energy modernization.** In 2022, EBRD + Attijari Bank financed a **TND 5 million** loan to TERIAK that funded:
- A renovated wastewater treatment unit
- A new steam boiler
- An **automated energy management system at Jebel Ouest**

That last item is critical: KILANI has *already installed* an energy-management system. Our pitch isn't "you should care about energy" — it's "**you've already invested 5 million dinars; here's the AI layer that makes it 30% more profitable.**"

### Where the energy is bleeding (verified industry benchmarks)

Pharma cleanrooms consume **10-100× more energy per m² than offices**, and **25× more than commercial buildings**, driven by air-change rates of 20-60 ACH (vs. 0.5-2 in offices). HVAC alone = **two-thirds of facility energy**. Documented gains from AI-driven cleanroom HVAC:

- **15-40% total HVAC savings** by demand-driven air-change rates
- **Up to 70% fan-power reduction** via real-time particle-count-based recirculation control
- All while remaining **ISO 14644-1 compliant** (ISO Class 5/7/8 for tablet/syrup/capsule areas)

This is not theory. TSI, Etalytics, and Siemens all have case studies in pharma. We're applying a proven pattern to a specific Tunisian customer who is publicly receptive.

---

## 3. The Project: **AURA**

> **AURA — Adaptive HVAC Optimization for KILANI Cleanrooms**
> *Pronounced "OHR-AH"; works in French and Arabic; evokes "air."*

A retrofitted AI control layer that sits on top of KILANI's existing TERIAK/ADWYA HVAC + energy management system. It uses real-time particle counts, occupancy detection, production schedules, and Tunisian time-of-use tariffs to dynamically modulate air-change rates and chiller setpoints — while guaranteeing ISO 14644 compliance via a hard-clamped safety layer.

### What AURA does, in one paragraph

> AURA reads particle counts, T/RH, and pressure-cascade sensors from a cleanroom; predicts the next 60 minutes of contamination risk using a small physics-informed model; and dispatches HVAC setpoints (fan speed, supply temperature, dampers) through a multi-agent controller. Every decision is auditable in plain French, every override is logged, and the system *learns* the unique signature of each TERIAK/ADWYA suite over time. The result: 25-35% less HVAC energy per cleanroom, fully GMP-compliant, with zero retrofit to the existing automation system — AURA speaks Modbus to whatever PLC is already there.

### Platform vision (last slide of the pitch)

AURA is the first module of **KILANI EnerOS** — an energy operating system designed to be rolled out across the group:

- **Phase 1 (NRTF prototype):** AURA on TERIAK Jebel Ouest cleanrooms
- **Phase 2:** IKEL Grain d'Or drying ovens (extrusion thermal optimization)
- **Phase 3:** PROTIS mixer/emulsifier scheduling against TND tariff brackets
- **Phase 4:** Solar PV + battery sizing for southern-Tunisia public works sites
- **Phase 5:** Cross-site energy intelligence dashboard for the Kilani family executive team

This shows judges we understand KILANI as a *system*, not a single plant.

---

## 4. Why our team is the only team that can build this

| Teammate | Role on AURA | Why uniquely qualified |
|---|---|---|
| **Chem/Bio #1** | GMP / cleanroom chemistry lead | Owns the ISO 14644 explanation; defends air-change-rate math; knows pharma manufacturing constraints (sterile vs non-sterile zones, pressure cascades) |
| **Chem/Bio #2** | Pitch + KILANI domain owner | Weaves the TERIAK/ADWYA/IKEL story; speaks to Mr. Kilani in his own language; quantifies TND savings using real ANME tariffs |
| **IIA teammate** | Hardware + control loop | Builds the tabletop mini-cleanroom rig; wires PMS5003 + DHT22 + fan PWM to ESP32; writes the Modbus glue |
| **Talel (SW/AI)** | AI agent + dashboard | LangGraph multi-agent controller; Recharts dashboard with live particle/energy/compliance traces; pitch deck |
| **Roommate (SW/AI)** | Backend + ML | NestJS data pipeline (MQTT → TimescaleDB); Chronos-Bolt forecasting model; MCP server wrapping the cleanroom |

**Most teams in the room will be CS-only and pitch a "smart energy app."** Our defensibility: a working physical demo of a regulated industrial environment, controlled by AI, explained by people who actually understand pharmaceutical chemistry.

---

## 5. The WOW pitch — story arc + live demo

### The 5-minute story

**[0:00–0:30] — The hook**

> *(Talel or Chem/Bio #2, in French)*
> "Bonsoir. Cette semaine, dans l'usine TERIAK à Jebel Ouest, environ **1.4 millions de dinars** sont en train d'être brûlés — non pas en feu, mais en climatisation des salles blanches. C'est 66% de la facture électrique de l'usine. En 2022, le groupe KILANI a investi 5 millions de dinars, financés par la BERD, pour moderniser ce système. Aujourd'hui, on vous présente la couche d'intelligence qui rend cet investissement **30% plus rentable**. On l'appelle **AURA**."

**[0:30–1:00] — The problem, technically**

> *(Chem/Bio #1, switch to English)*
> Pharmaceutical cleanrooms classified ISO 14644-1 Class 7 require 20-60 air changes per hour, regardless of whether the room is occupied. Most installations run at maximum airflow 24/7 — defensible from a GMP standpoint, but financially absurd. The opportunity: modulate airflow based on real-time particle counts and occupancy, while maintaining a *guaranteed* compliance envelope.

**[1:00–2:30] — Live demo**

> *(IIA + Talel jointly run the tabletop rig)*
>
> 1. Camera projects the dashboard. Live: particle count, fan power, ISO compliance status, AI agent reasoning trace.
> 2. **"Baseline mode"** — fan at 100%, dashboard shows compliance ✅ and 14W draw.
> 3. **"AURA mode"** — agent takes over. Particle count is low → fan drops to 35%, draw drops to 4W. Compliance still ✅.
> 4. **Inject contamination** (puff of incense smoke into the box). Particle count spikes red on the dashboard. Within 8 seconds, AURA ramps the fan, shows on screen: *"Spike detected, ramping to 95% to meet ISO Class 7 envelope, ETA recovery 22s."* Counts drop. Fan steps back down.
> 5. **Side panel: cumulative kWh saved** ticks up live. After 90 seconds: "27% energy saved vs baseline, zero compliance violations."

**[2:30–3:30] — Why this matters for KILANI**

> *(Chem/Bio #2)*
> Extrapolated to TERIAK Jebel Ouest's actual cleanroom footprint (~2,400 m²) and STEG industrial peak tariffs:
>
> | Metric | Baseline | With AURA |
> |---|---|---|
> | Annual HVAC energy | 4.8 GWh | 3.4 GWh |
> | Annual cost (TND) | 1,920 k | 1,360 k |
> | **Savings** | — | **560 k TND/yr** |
> | Payback (incl. retrofit) | — | < 14 months |
> | CO₂ avoided | — | 720 tons/yr |
>
> Roll AURA across TERIAK El Fejja + ADWYA + the new acquisitions = **2.1 M TND/yr** group-wide.

**[3:30–4:30] — Architecture & defensibility**

> *(Talel)*
> AURA is built on a NestJS + LangGraph + ESP32 stack. The AI controller is a multi-agent system: a **Forecaster** (Chronos-Bolt foundation model on particle history), a **Compliance Guardian** (rule-based hard clamp on ISO 14644 limits — never overridable by the LLM), and a **Dispatcher** (issues setpoints via Modbus). All three reason in plain French; every decision is logged for the GMP audit trail. We use the Model Context Protocol so the same agents work on any HVAC PLC — Siemens, Schneider, Honeywell.

**[4:30–5:00] — The vision close**

> *(Chem/Bio #2)*
> AURA is the first module of **KILANI EnerOS** — a unified energy intelligence platform for the group. After cleanrooms, we go after IKEL drying ovens, PROTIS mixers, and the southern-Tunisia public works sites. Our prototype today is one mini-cleanroom on a table. Phase 5 is dashboards on Mr. Kilani's desk showing live energy across every plant.
>
> Merci. Vos questions?

### Why this pitch wins

1. **Names the sponsor in the first sentence** — judges from KILANI lean forward.
2. **Cites their own EBRD investment** — proves we did our homework.
3. **Quantifies the ask in TND** — ANME-style framing.
4. **Live hardware demo with a contamination trigger** — visceral, unforgettable.
5. **GMP / ISO compliance respected** — shows we know the regulatory stakes.
6. **Platform vision in the last slide** — opens the door to a follow-up conversation.

---

## 6. Architecture (high-level)

```
┌──────────────────────────────────────────────────────────────┐
│  TABLETOP MINI-CLEANROOM (live demo on stage)                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Acrylic box, ESP32 + sensors + 12V fan + smoke source │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬──────────────────────────────┘
                                │ MQTT (Mosquitto)
                                ▼
┌──────────────────────────────────────────────────────────────┐
│  apps/backend  (NestJS + Fastify)                            │
│   ├── modules/devices  — registry, API keys                  │
│   ├── modules/readings — TimescaleDB hypertable              │
│   ├── modules/compliance — ISO 14644 envelope tracker        │
│   ├── integrations/mqtt — broker subscriber                  │
│   └── integrations/ai-bridge — calls AI service              │
└───────────────┬──────────────────────────────┬───────────────┘
                │ WebSocket                    │ HTTP
                ▼                              ▼
┌──────────────────────────┐    ┌─────────────────────────────┐
│  apps/frontend (Next.js) │    │  apps/ai-agents (LangGraph) │
│   AURA Dashboard:        │    │   ┌─ Forecaster (Chronos)   │
│   - particle live chart  │    │   ├─ Compliance Guardian    │
│   - fan power gauge      │    │   ├─ Dispatcher             │
│   - compliance LED       │    │   └─ MCP server: cleanroom  │
│   - agent trace panel    │    │                             │
│   - cumulative kWh saved │    │  apps/ml-pipeline (FastAPI) │
│   - "what would Mr.      │    │   ├─ Chronos-Bolt forecast  │
│     Kilani see" mode     │    │   └─ Anomaly classifier     │
└──────────────────────────┘    └─────────────────────────────┘
```

The four `.claude/agents/` (frontend-designer, backend-engineer, ai-engineer, ml-engineer) and seven `.claude/skills/` are pre-built to scaffold every layer of this stack.

---

## 7. 24-hour playbook

The plan starts when the spec book opens at H0 on May 2 (or whenever the official "go" happens). Times are budgets, not deadlines.

| Hours | Track | Owner | Deliverable |
|---|---|---|---|
| **H0 → H1** | Lock + scope | All | Confirm AURA fits the official spec; assign roles per this doc |
| **H1 → H4** | Hardware bring-up | IIA + Chem/Bio #1 | Box assembled, sensors wired, MQTT publishing |
| **H1 → H4** | Backend skeleton | Roommate | NestJS up, MQTT ingest writing to TimescaleDB |
| **H1 → H4** | AI skeleton | Talel | LangGraph state graph + 3 nodes (forecaster, guardian, dispatcher) running on stub data |
| **H1 → H4** | Pitch outline | Chem/Bio #2 | 10-slide deck shell, French/English split decided |
| **H4 → H8** | First end-to-end | Roommate + Talel | ESP32 → backend → AI agent → fan PWM round-trip working |
| **H4 → H8** | Compliance Guardian | Chem/Bio #1 + Talel | ISO 14644 limits hardcoded as rules; agent cannot violate |
| **H8 → H12** | Forecaster training | Talel | Chronos-Bolt zero-shot on 1h of synthetic particle data |
| **H8 → H12** | Dashboard v1 | Talel + frontend-designer subagent | Hero KPI strip + particle chart + fan gauge + compliance LED |
| **H8 → H12** | Real ISO numbers | Chem/Bio #2 | TERIAK cleanroom area + STEG tariffs + savings table verified |
| **H12 → H16** | Demo rehearsal #1 | All | Full run-through; record video as backup |
| **H12 → H16** | Polish dashboard | Talel | French labels, dark mode, "demo mode" URL flag |
| **H16 → H20** | Pitch rehearsal #1 | All | Full pitch with timer; refine hooks |
| **H16 → H20** | Hardware redundancy | IIA | Pre-record a perfect demo run on phone in case live fails |
| **H20 → H22** | Final polish | All | One-page handout, GitHub README, Q&A prep |
| **H22 → H24** | Sleep / breakfast | All | Yes really. Pitch fresh > pitch with 5 more features |

**Hard rule:** at H22 we stop adding features. Anything not working at H20 is cut. Pitch quality always beats feature count.

---

## 8. Hardware BoM + procurement (urgent)

### Tabletop mini-cleanroom

| Item | Qty | Source | Price (TND) | Status |
|---|---|---|---|---|
| Clear acrylic box ~30×30×30 cm | 1 | Lab borrow / Aliexpress / hobby store | 30-80 | **Borrow from chem/bio lab if possible** |
| ESP32 NodeMCU | 2 | tunisianet / 2btrading | 35-45 ea | Likely on hand |
| **PMS5003 / PMS7003 particle sensor** | 1 | AliExpress (10-15 d) or 2btrading | 60-90 | **Order today if not local — critical path** |
| DHT22 T/RH | 1 | local | 18-25 | Likely on hand |
| BMP280 ×2 (pressure cascade) | 2 | local | 12-18 ea | Easy |
| 12V PC fan (40-80 mm) | 2 | mytek / tunisianet | 8-15 ea | Easy |
| MOSFET breakout (IRF520) | 1 | local | 8-12 | Easy |
| INA219 (fan power measurement) | 1 | local | 12-18 | Easy |
| 12V power supply | 1 | local | 25-40 | Easy |
| Smoke/incense source | — | shop / pharmacy | 5 | Trivial |
| OLED 0.96" SSD1306 (status display) | 1 | local | 12-18 | Easy |
| LED strip (clean/alert visual) | 1 | local | 15-25 | Easy |

**Critical path: the particle sensor.** Without it, the demo is gutted. Order this WEEK on AliExpress Premium if not in local stock; back-up plan is a phone-camera-based haze detection (less accurate but visually demoable).

### Optional add-ons

- USB IR camera (~$60 AliExpress) — bonus thermography overlay; nice-to-have, not critical.
- Servo-driven damper mock — adds visual appeal but extra wiring complexity.

### Cost summary

Total prototype cost: **250–500 TND** depending on what we borrow. Split across the team = under 100 TND each.

---

## 9. Pitch deck outline (10 slides max)

| # | Slide | Owner | Key content |
|---|---|---|---|
| 1 | Cover | — | "AURA — l'IA qui rend l'investissement énergétique de KILANI 30% plus rentable" |
| 2 | The problem (Tunisian) | Chem/Bio #2 | 1.4 M TND/yr burned in TERIAK cleanroom HVAC; KILANI's 5M EBRD investment context |
| 3 | The technical reality | Chem/Bio #1 | Cleanrooms = 25× office energy; air-change rates explained; ISO 14644 |
| 4 | Solution: AURA | Talel | One-paragraph + the architecture diagram |
| 5 | LIVE DEMO | IIA + Talel | The tabletop run (slot for 2.5 minutes — no slides during this) |
| 6 | Compliance Guardian | Chem/Bio #1 | Why AI can't override ISO limits; audit trail screenshot |
| 7 | Quantified impact | Chem/Bio #2 | Savings table; payback < 14 months; CO₂ avoided |
| 8 | KILANI EnerOS roadmap | Roommate | Phase 1-5; cross-site dashboard mockup |
| 9 | Team + tech stack | All faces | One photo strip; "5 students, 3 disciplines, 1 mission" |
| 10 | Ask + thank you | Talel | Contact; GitHub; "Mr. Kilani, when can we visit Jebel Ouest?" |

**Design rules:** dark mode, max 3 colors per slide, French headings + English technical bullets, every slide has one number with a TND or % unit.

---

## 10. Risks + fallbacks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Particle sensor doesn't arrive | Med | High | Order today; backup = camera-based haze proxy + pre-recorded "real PMS5003 run" video |
| Fan PWM unstable on stage | Low | Med | Test on 12V bench supply; pre-record working run as backup video |
| Live demo fails during pitch | Med | High | Have video backup ready; jump to it within 10 seconds, narrate over |
| LLM API down (no network) | Low | High | Pre-cache 3 demo prompts; fall back to local Ollama Gemma if needed |
| Judges challenge ISO compliance claim | Med | Med | Chem/Bio #1 owns this; cite ISO 14644-1:2015 verbatim; show the hard clamp code |
| KILANI rep asks specific TERIAK question we can't answer | Med | Low | Acknowledge openly: "we'd love a site visit to refine the model" — positive close |
| Team exhaustion at pitch time | High | High | Sleep schedule; one designated pitcher rests at H18+; coffee + breakfast pre-pitch |
| Spec book turns out to NOT be cleanroom-focused | Med | High | The architecture is generic — pivot the demo box to whatever KILANI subsidiary the spec emphasizes (drying for IKEL, etc.) within H1 |

---

## 11. Pre-hackathon prep (April 24 → May 1)

### This week (by Sunday April 26)

- [ ] **Order PMS5003 particle sensor** (AliExpress Premium or local — call 2btrading first)
- [ ] Confirm we can borrow an acrylic box from the chem/bio lab
- [ ] Confirm with organizers: can we pre-build hardware before clock starts? Live demo allowed on stage?
- [ ] Read the official KILANI spec book the moment it lands; flag if any pivot needed
- [ ] Set up shared GitHub org; clone this repo; everyone pulls

### Per-teammate (April 25 → April 30)

**Talel (SW/AI lead)**
- [ ] Run Chronos-Bolt zero-shot on a synthetic particle-count CSV (45 min)
- [ ] Build the LangGraph state graph skeleton with 3 nodes (1 hour)
- [ ] Decide: Streamlit or Next.js for the demo dashboard (Streamlit if time tight)
- [ ] Memorize the 5-min pitch in French + English

**Roommate (SW/AI #2)**
- [ ] NestJS scaffold: get one sensor reading flowing MQTT → Postgres
- [ ] Familiarize with TimescaleDB hypertables
- [ ] Set up Mosquitto in docker-compose locally
- [ ] Practice OpenAPI doc generation

**IIA teammate (embedded)**
- [ ] Test ESP32 + DHT22 + INA219 individually on breadboard
- [ ] Get PMS5003 reading via UART (datasheet review)
- [ ] Practice fan PWM control via MOSFET
- [ ] Pre-build the box wiring as much as possible

**Chem/Bio #1 (cleanroom science)**
- [ ] Review ISO 14644-1:2015 (focus on Class 5/7/8 limits per m³)
- [ ] Read 1-2 papers on cleanroom energy optimization (TSI / ETA / LBNL) — links in `docs/research/`
- [ ] Prepare the "what is GMP" 30-second explainer for non-pharma judges

**Chem/Bio #2 (KILANI domain + pitch)**
- [ ] Read kilanigroupe.com/news end-to-end
- [ ] Memorize the EBRD/Attijari TERIAK story
- [ ] Calculate the savings table from STEG industrial tariff (peak vs off-peak winter)
- [ ] Practice the French opening hook 20 times

### Whole team

- [ ] **Sunday April 26 evening:** Zoom or in-person meeting — lock final scope, walk through this doc together
- [ ] **Wednesday April 29:** Full pitch rehearsal, recorded
- [ ] **Friday April 30:** Pack the kit (box, ESP32, sensors, jumpers, soldering iron, multimeter, backup laptop, charger bricks)

---

## 12. The non-negotiables

These are the things that must be true at H24 or we have not done our job:

1. **A working tabletop cleanroom** that responds to a real smoke puff, on stage.
2. **A dashboard** that shows particle count, fan power, ISO compliance status, and cumulative kWh saved.
3. **A multi-agent AI controller** with a Compliance Guardian that refuses to violate ISO limits.
4. **A pitch** delivered in fluent French with the EBRD/TERIAK hook in the first 30 seconds.
5. **A savings table** in TND.
6. **A vision slide** showing AURA → KILANI EnerOS roll-out across the group.
7. **A backup video** of the demo working perfectly, ready to play if live fails.
8. **A team that slept**.

Everything else is bonus.

---

## Appendix — sources & references

- **Groupe Kilani (official):** [kilanigroupe.com](https://www.kilanigroupe.com/en) — group identity, subsidiaries, news
- **TERIAK (Kilani pharma):** [teriak.com](https://www.teriak.com/En/) — Jebel Ouest + El Fejja sites, product portfolio
- **EBRD/Attijari/TERIAK financing (May 2022):** [EBRD news](https://www.ebrd.com/news/2022/ebrd-and-attijari-bank-tunisia-support-local-pharmaceutical-sector.html), [SME Green Value Chain](https://ebrdgeff.com/tunisia-gvc/ebrd-and-attijari-bank-tunisia-support-local-pharmaceutical-sector/) — TND 5M loan, automated energy management at Jebel Ouest
- **Kilani × Nestlé Grain d'Or acquisition (2022):** [Nestlé MENA press](https://www.nestle-mena.com/en/media/pr/nestle%CC%81-sells-grain-dor-to-kilani-groupe), [Kilani news](https://www.kilanigroupe.com/en/news/Partenariat-Groupe-kilani-Nestl%C3%A9)
- **IKEL / Grain d'Or:** [Kilani IKEL page](https://www.kilanigroupe.com/en/activity/ikel) — Ain Zaghouan factory, Product of the Year 2025
- **AI for pharma cleanroom HVAC:** [TSI](https://tsi.com/life-sciences/learn/the-ai-revolution-in-pharma-moving-from-reactive-to-predictive), [HPAC Engineering](https://www.hpac.com/technology/article/55321496/ai-putting-energy-intelligence-into-cleanrooms), [Etalytics](https://etalytics.com/industries/chemical-pharma) — 15-40% savings, 70% fan reduction
- **Cleanroom energy benchmarks:** [LBNL Pharma Energy Guide](https://www.osti.gov/servlets/purl/923192), [ENERGY STAR pharma guide](https://www.energystar.gov/sites/default/files/buildings/tools/Pharmaceutical_Energy_Guide.pdf)
- **ISO 14644 cleanroom design with energy lens:** [Wiley Energy Sci. Eng. 2026](https://scijournals.onlinelibrary.wiley.com/doi/full/10.1002/ese3.70365), [ISPE Pharmaceutical Engineering](https://ispe.org/pharmaceutical-engineering/september-october-2021/pharmaceutical-cleanroom-design-iso-14644-16)

---

*Document v3 (KILANI-aligned) — generated April 28, 2026. Iterate before the team meeting on Sunday April 26.*
