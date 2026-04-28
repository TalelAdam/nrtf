# NRTF 3.0 Hack-E — v2: AI-Trend Idea Bank, Fintech Crossovers & Prep Kit

> Companion to **v1** (which has the 12-idea long-list and the H2/Battery/Greenhouse finalists).
> v2 adds: cutting-edge AI trends mapped to energy ideas, energy×fintech crossovers, 5 wildcard fusion plays, procurement table, and dataset library.
> Read v1 first if you haven't.

---

## Part 1 — The "AI Trend × Energy" Map

The judging room will be IEEE PES/PELS academics. They've heard "AI for energy" a hundred times. Your job is to use a 2026 buzzword in a way that *actually* solves something only your team can solve. Here's the trend menu, ordered by how well it fits a 5-person chem/bio + automation + AI team:

### Tier 1 — Use these

| # | Trend | The energy idea that fits us |
|---|-------|------------------------------|
| **A** | **MCP servers wrapping legacy SCADA/Modbus** | Build an MCP server exposing our ESP32-simulated "inverter" + INA219 sensors as tools. Let Claude diagnose a fault by chatting. **Killer because:** IIA member writes the Modbus glue, no CS-only team will have an embedded engineer who knows holding registers. |
| **B** | **PINNs (Physics-Informed Neural Networks)** | PINN-based SoC/temperature estimator for an 18650 cell — embed Arrhenius + heat-equation as the loss term. Predicts internal temp without expensive sensors. **Killer because:** the chem/bio teammates literally write the equations. CS teams cannot. |
| **C** | **Time-series foundation models** (Chronos-2, TimesFM, Moirai) | "Plug-in Forecaster" — point Chronos-Bolt at any STEG load CSV with one line of Python; show day-ahead forecast with calibrated intervals vs Prophet baseline live. **Killer because:** zero-shot, no GPU; we look like wizards in 30 seconds. |
| **D** | **TinyML on ESP32** (Edge Impulse / TFLite Micro) | Single CT clamp on the mains → ESP32 classifies fridge/AC/kettle in real time. Recent papers hit 99.49% on ESP32. **Killer because:** plug appliances in live and watch them appear in the dashboard. |
| **E** | **Multimodal LLMs** (Gemini 2.5 / Claude 4 vision) | "SnapMeter" — phone photo of any analog/digital STEG meter → LLM extracts kWh → forecasts next month's bill. Bonus: thermal-image upload flags hot connectors. **Killer because:** addresses the *real* Tunisian problem of paper bills + no smart meters. |
| **F** | **Small Language Models on-device** (Gemma 4, Phi-4) | Gemma 4 on a Pi 5 = offline "STEG assistant" answering Tunisian Arabic/French questions about the household bill. No cloud, no privacy leak. **Killer because:** sovereign AI narrative + bilingual prompt tuning Western teams won't do. |
| **G** | **Agentic AI** (LangGraph, Claude Agent SDK) | "Microgrid Crew" — 4 agents (Forecaster, Battery Operator, Load Scheduler, Tariff Negotiator) coordinating real ESP32 relays on a 3-load demo. **Killer because:** auditable trace = judges can see *why* each decision happened. |

### Tier 2 — Strong if paired with Tier 1

| # | Trend | Idea |
|---|-------|------|
| H | **Federated learning** | 3 ESP32 "homes" run local consumption ML, FedAvg aggregator, differential-privacy slider. Pairs with D (TinyML). |
| I | **Diffusion models for non-image** | DDPM generates 1000 next-week scenarios; toy 3-bus power flow flags % causing line overload. Pairs with C (forecasting). |
| J | **RL + sim-to-real** (Sinergym → Peltier rig) | PPO trained in EnergyPlus, deployed to control a Peltier "mini-room." Best for v1's Greenhouse idea. |
| K | **Graph neural networks** (PowerGNN, NeurIPS 2024) | GNN trained on IEEE 14-bus predicts line overload after any contingency; web UI lets user "trip" a line and see millisecond risk. |
| L | **Causal inference** (DoWhy/EconML) | "Shift dishwasher 2h later" → counterfactual cost & peak impact with confidence interval. Bolt-on to G. |
| M | **SHAP/LIME interpretability** | Wrap any model with SHAP → feed top-3 features into Claude → plain-language explanation. Layer on top of B/D/K. |
| N | **Voice + Whisper + TTS** | "What's the temperature on transformer T2?" → Whisper → MCP tool → Piper TTS reply. Tunisian Arabic = bonus. |
| O | **Synthetic data generation** | 50 real Tunisian households → 10,000 synthetic profiles → train forecasting model → prove generalization. The data-scarcity story. |

### Tier 3 — Garnish only

P. AR overlays (smartphone WebXR with Three.js + AR.js — visual punch, judges care less)
Q. Spatial computing / Quest 3 (skip — budget)
R. Open-source tool-calling (subsumed by G)
S. Digital twins (skip Omniverse; use OpenModelica + Three.js if used)

---

## Part 2 — Five Wildcard Fusion Plays (NEW HEADLINERS)

These combine 2–3 trends. Each is rated /10 for win potential.

### 🔥 W1 — "AthenaGrid" — PINN + Agentic + MCP — **9/10**
A LangGraph agent uses a battery PINN as a tool **via MCP** to make safe fast-charge decisions on a real 18650, with SHAP explanations streaming to the dashboard.
- **Trends:** A + B + G + M
- **Why it wins:** Maximum cross-disciplinary defensibility. Hits PES (electrochemistry) AND PELS (charging power electronics). The PINN is unfakeable — chem/bio engineers literally write the loss function. Agentic + MCP buys the buzzword bingo card.
- **24h scope:** Use NASA PCoE or Severson dataset to pretrain PINN; deploy on Pi reading INA219 from one cell; LangGraph agent decides charge current; MCP server exposes "get_battery_state" / "set_charge_current" tools.

### 🔥 W2 — "STEG Whisperer" — Multimodal + SLM + Voice + Synthetic — **9/10**
Local **Gemma 4 on a Pi** answers Tunisian household questions in **Arabic/French/English**, trained on synthetic Tunisian profiles, with photo-bill ingestion. Fully offline, sovereign AI.
- **Trends:** E + F + N + O
- **Why it wins:** Hyper-local, sovereign-AI narrative judges in Tunis will love. Hard for any non-Tunisian team to copy. Speaks to the rural-connectivity story (PROSOL Élec économique just targeted 65,000 rural+middle-income households).
- **24h scope:** Pi 5 + Gemma 4 e2b (4-bit) + Whisper-tiny multilingual + Piper TTS; MobileVLM for bill-photo OCR; mock STEG bill dataset.

### 🔥 W3 — "ScenarioForge" — Diffusion + GNN + Causal — **8.5/10**
DDPM generates 1000 next-week grid scenarios → GNN does instant N-1 contingency on each → causal layer answers "what if we add 5MW PV at bus 7?" Single dashboard, three trendy techniques.
- **Trends:** I + K + L
- **Why it wins:** Heavyweight power-systems substance; PES jury will be stunned. Risk = over-scoping; de-risk by starting with IEEE 14-bus + a tiny pretrained DDPM.
- **24h scope:** Pure software, no hardware moat. Use only if hardware fails or if we want a "pure intelligence" play.

### 🔥 W4 — "EdgeFleet" — Federated + TinyML + Blockchain Oracles — **8/10**
3 ESP32 NILM nodes (TinyML appliance ID) federated-learn appliance signatures → aggregated weights notarized on-chain via a Chainlink-style oracle for auditability. Privacy + provenance double buzzword.
- **Trends:** D + H + (Web3 angle)
- **Why it wins:** 3 physical ESP32s on the demo table = visceral. Embedded engineer moat. Judges may argue blockchain is unnecessary — have a snappy "regulatory audit trail" rebuttal ready.

### 🔥 W5 — "RL Twin" — RL + Digital Twin + Sim-to-Real + Voice — **8.5/10**
Sinergym-trained PPO controls a **Peltier mini-room** via ESP32; browser digital twin shows live state; engineer voice-queries "why did you turn down the AC?" and Claude explains via SHAP.
- **Trends:** J + N + M + Browser-twin
- **Why it wins:** Most impressive *live* demo on this list. The Peltier + voice + browser twin combo is gif-able and wins the audience-vote round.

---

## Part 3 — Energy × Fintech Crossovers (You explicitly asked for this)

**Tunisia regulatory note:** BCT's 2018 crypto ban is still nominally in force, but a regulatory sandbox exists and a virtual-asset framework is expected by 2026. Pitch all of these as **"regulatory-sandbox-ready"** prototypes, not production deployments. Mobile-money rails (D17, Flouci, Sobflous) are real and usable.

### 💰 Top 3 fintech picks for our team

#### F1 — **SolREC-Tn** — Tokenized I-RECs for Tunisian rooftops
> "Every kWh your rooftop exports to STEG mints a transferable I-REC token; corporates buy them to meet ESG mandates."

- **24h MVP:** Solidity ERC-1155 (`mintREC(meterId, kWh, timestamp)`) on Hardhat + Polygon Amoy testnet. Node oracle pulls our ESP32 power-meter MQTT stream, signs an attestation, calls `mintREC`. Next.js dashboard with "Buy Green" button retiring tokens against a fake corporate buyer.
- **Hardware moat:** ESP32 + PZEM-004T or SCT-013 CT clamp on the lab solar panel. Real kWh → real mint. **This is the moat.**
- **Why it wins NRTF:** Maps directly onto the 2026 Tunisian rooftop boom (288 MW small-commercial rooftop approved 2024-2025; PROSOL Élec économique just launched). Hardware-to-blockchain pipeline is unambiguous and demo-able in 60 seconds.

#### F2 — **SoukWatt** — P2P solar microgrid for an INSAT dorm block
> "Neighbours with rooftop PV sell surplus kWh to neighbours without, settled every 15 minutes via smart contract."

- **24h MVP:** 3 ESP32 nodes (2 producers with mini-PV + 1 consumer with a fan/lamp) → local Hardhat chain → Solidity continuous-double-auction contract clears every 15 min. React dashboard shows order book + settled trades + live current/voltage.
- **Hardware moat:** 3 physical ESP32 boxes on the demo table + live blockchain explorer = unbeatable theatre.
- **Why it wins NRTF:** Hits PES (microgrids) AND PELS (inverter electronics on each node). The double-auction Solidity shows engineering depth, not just contract templates.

#### F3 — **PaySun** — PAYGo solar lockbox with mobile-money rails (M-KOPA-style)
> "Off-grid Tunisian farmer leases a solar pump on D17/Flouci instalments; missed payment auto-locks the inverter via IoT; on-chain ledger guarantees fair re-activation."

- **24h MVP:** ESP32 + relay = "PAYGo lockbox" controlling a 12V pump. Backend simulates D17 webhook → updates loan contract → if payment received, contract emits `Unlock(deviceId)`, oracle relays MQTT, relay closes. Streak missed = lockout.
- **Hardware moat:** Lockbox + visible water flow = unforgettable demo.
- **Why it wins NRTF:** Combines Tunisian agriculture + financial inclusion + a *real* mobile-money rail. Sponsor magnet for any fintech-adjacent company. M-KOPA is a billion-dollar reference.

### 💰 Honorable mentions
- **CarbonBridge Tn** (carbon-credit fractionalizer) — strong tech but greenwashing critique is well-documented; defend carefully.
- **PeakBid** (DR auction for SMEs) — solid PES alignment, weaker fintech narrative.
- **kWhUSD** (energy-collateralized stablecoin) — coolest concept but most regulator-spooky in Tunisia.
- **ChargeChain** (crypto micropayments for EV chargers) — strong if EV theme heats up; Tunisia has <50 public chargers so framing is "future-state."

### 💰 Skip
- **GridOracle** (prediction market on grid peaks) — no hardware moat, gambling regulation risk.
- **MeterDAO** (smart-meter data union) — privacy law adds 8h of yak-shaving you don't have.

---

## Part 4 — UPDATED Master Shortlist (v1 + v2 fusion)

The full menu now has 12 cross-disciplinary ideas (v1) + 20 AI-trend ideas + 10 fintech ideas + 5 wildcards. Here's the consolidated **TOP 7 to actually pick from**:

| Rank | Project | Source | Trend mix | Defensibility | Demo wow | Best for |
|------|---------|--------|-----------|---------------|----------|----------|
| 🥇 | **AthenaGrid** (W1) | v2 | PINN + Agentic + MCP + SHAP | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Maximum technical-depth play |
| 🥈 | **H2-Sentinel** | v1 | Real chemistry + ML | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Sponsor-topical (hydrogen) |
| 🥉 | **STEG Whisperer** (W2) | v2 | SLM + Voice + Synthetic + Multimodal | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Hyper-local sovereign-AI narrative |
| 4 | **SoukWatt** (F2) | v2 | P2P fintech + microgrid + hardware | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Energy×fintech sponsor magnet |
| 5 | **Thermal Runaway Sentinel** | v1 | Real chemistry + CUSUM/LSTM | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Most theatrical demo (with safety risk) |
| 6 | **RL Twin** (W5) | v2 | Sinergym + Peltier + Voice + SHAP | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Audience-vote winner if format has one |
| 7 | **PaySun** (F3) | v2 | IoT + mobile-money + smart contract | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Best story (fintech + agriculture + inclusion) |

**Decision heuristic:** if PEM cell arrives → H2-Sentinel + Athena fusion. If not → AthenaGrid pure (use any 18650). If team prefers narrative over hardware drama → STEG Whisperer.

---

## Part 5 — Procurement Plan (TIME-CRITICAL)

**Today is April 24, 2026. Hackathon starts May 1. 7 days.**

### 🚨 Must order BY SUNDAY April 26 (international shipping, 5–9 d via AliExpress Premium)

| Item | Why critical | Backup |
|------|-------------|--------|
| **Hobby PEM electrolyzer cell** ($15–90) | H2-Sentinel impossible without it | Drop the build, pivot to AthenaGrid |
| **MQ-8 hydrogen sensor** | Local stock unreliable | Local 2btrading/didactico if in stock today |
| **DFRobot pH probe + driver** | Only if doing CO2 mineralization or bioethanol idea | Skip those ideas |
| **DFRobot EC probe** | Same as above | Skip those ideas |

### 🛒 Local Tunis order (Saturday April 25, courier Monday April 27)

Single consolidated order across **tunisianet.com.tn + 2btrading.tn + didactico.tn**. Call ahead for Pi 4B-4GB + MQ-8 stock.

| Item | Source | Price (TND) |
|------|--------|-------------|
| 3× ESP32 NodeMCU | 2btrading / Souilah / Jumia | 35–45 ea |
| 1× ESP32-CAM | 2btrading / SELI | 45–60 |
| 1× Raspberry Pi 4B 4GB | SNE Sometel / celectronix | 350–430 |
| 1× Pi Camera v2 | Didactico / 2btrading | 90–110 |
| 4× INA219 | tunisianet | 12–18 ea |
| 2× ADS1115 | tunisianet | 18–28 ea |
| 2× DHT22 | jumia / 2btrading | 18–25 ea |
| 2× BH1750 | 2btrading | 10–15 ea |
| 2× DS18B20 waterproof | 2btrading | 15–22 ea |
| 1× MAX6675 + K thermocouple | 2btrading | 25–35 |
| 1× SCT-013-100 clamp | 2btrading | 35–55 |
| 1× HX711 + 1kg load cell | Souilah | 35–60 |
| 4× relay 1ch + 1× 4ch | tunisianet | 6–18 ea |
| 2× IRF520 MOSFET | 2btrading | 8–12 ea |
| 2× 12V mini fan | mytek / tunisianet | 8–15 ea |
| 1× Peltier TEC1-12706 + heatsink | Souilah / 2btrading | 25–45 |
| 2× SG90 servo | tunisianet | 8–12 ea |
| 1× 5W solar panel (6V) | tunisianet | 35–60 |
| 1× 5V mini water pump | jumia | 10–18 |
| 3× sacrificial LiPo 1S 1000mAh | tunisianet / RC shops | 25–40 ea |
| 4× 18650 cells + 2-slot holder | mytek / tunisianet | 25–35 + 5 |
| 4× capacitive soil moisture | tunisianet | 8–12 ea |

**Estimated total local spend: 1,400–2,000 TND.** Split across 5 teammates ≈ 280–400 TND each.

### 🏫 INSAT lab borrow list

Try to borrow rather than buy: clamp meter, oscilloscope, soldering iron + helping hands, multimeter, thermocouple thermometer (calibration), bench PSU.

---

## Part 6 — Datasets Library (per project)

| Project family | Best datasets |
|----------------|---------------|
| **Battery (Thermal Runaway, EIS-Lite, AthenaGrid)** | NASA PCoE, MIT-Stanford-Toyota Severson 2019 (124 LFP cells), CALCE, Sandia/Battery Archive |
| **Anaerobic Digestion / Biogas** | Holliger et al. BMP database (Bioresour. Technol. 2024) — CSV via supplementary |
| **Solar / PV forecasting** | NASA POWER (Tunis lat 36.8 lon 10.18, GHI/DNI 1981→), PVGIS, Global Solar Atlas |
| **Greenhouse** | Wageningen Autonomous Greenhouse Challenge 1st/2nd/3rd/4th editions (4tu.nl) |
| **NILM / appliance disaggregation** | UK-DALE, REDD, AMPds, Pecan Street Dataport, ENERTALK |
| **Electrolyzer / Hydrogen** | NREL HydroGEN consortium open data |
| **Grid (reference)** | ENTSO-E Transparency Platform (EU 15-min data; Tunisia not member but ELMED interconnect coming) |
| **Tunisia macro** | STEG annual reports, ANME publications, BCT statistics, World Bank Open Data — Tunisia |
| **Pretrained models for foundation forecasting** | Chronos / Chronos-Bolt (Amazon, HuggingFace), TimesFM (Google), Moirai (Salesforce), Gemma 4 (Google), Phi-4 (Microsoft), Whisper (OpenAI), Piper TTS |

Full URLs in `prep_links.md` (TODO — say the word and I'll generate it).

---

## Part 7 — Revised Decision Framework

**Pick by Sunday April 26.** Use this scoring across the top 7:

For each candidate, score 1–5 on:

1. **Critical-path hardware** is sourceable by April 30 (PEM cell? Pi 5? sensors?)
2. **Chem/bio teammates** are excited and can contribute substantively
3. **Demo failure mode survivable** — even if hardware breaks, can we still pitch?
4. **One-sentence problem** is something a Tunisian judge feels personally
5. **AI/buzzword coverage** that we can defend under Q&A (NOT decoration)

Pick the highest-total. Ties → bigger visual moment wins.

---

## Part 8 — Open Questions for Team Meeting

1. **Are the chem/bio teammates excited about an "AI co-pilot for chemistry" framing**, or do they prefer to lead with their own discipline?
2. **Does the IIA teammate already own:** ESP32 ×3, breadboard, soldering iron, MCP/MQTT broker familiarity?
3. **Hackathon rules check** with organizers (DM Khalil Khadhraoui or PES INSAT):
   - Can we **pre-build hardware** before the clock starts?
   - Is **live combustion / heating** allowed on stage?
   - Is there a **public audience-vote** round (changes which idea is best)?
   - **Pitch length**? (5 min? 10 min? Q&A duration?)
   - Required **deliverables**: GitHub link? Slide deck? Working demo? Video?
4. **Sleep strategy** — full team 24h or shifts of 2?
5. **Pitcher**: Who speaks French + English fluently for 8 min under pressure?

---

## Part 9 — What I'm queued to build for you next (you pick)

- [ ] **`prep_links.md`** — exhaustive clickable URL pack (every BoM item, every dataset, every framework, every paper) for one-click team distribution
- [ ] **24h hour-by-hour playbook** for the chosen project (per-teammate task list, hourly milestones)
- [ ] **10-slide pitch deck outline** (French opening, technical-depth slide, demo storyboard, Q&A prep)
- [ ] **Architecture diagram + ADR** for the chosen project (system design, tech stack rationale)
- [ ] **Mini-research deep-dive** on whichever wildcard the team picks (e.g., a how-to on PINN battery models, or on Solidity ERC-1155 RECs)
- [ ] **Slack/WhatsApp pitch message** to recruit the team's "yes" on a chosen direction

---

---

## Part 10 — Five MORE Wildcard Ideas (creative deep cuts)

The first five wildcards (W1–W5) came from systematic trend mapping. These five are weirder, riskier, and potentially more memorable. Use them as conversation starters in the team meeting.

### 🌀 W6 — "OliveBatt" — Olive-mill wastewater bio-battery + AI
> "Tunisia produces 600 kt/yr of olive-pomace and toxic margine. Convert it to electricity with a microbial fuel cell, monitor with AI, and quantify the negative-emission story."

- **Concept:** Two-chamber MFC fed with diluted olive-mill wastewater (margine d'olive); ESP32 logs voltage / current / pH / temperature; ML soft-sensor predicts "biofilm health score" and triggers MPPT load sweeps.
- **Trend stack:** Bio + electrochemistry + TinyML + soft sensor + IoT
- **Why it's special:** *Hyper-Tunisian.* Every Tunisian engineer knows the margine d'olive disposal nightmare. Solve it with electricity = unforgettable narrative. Bio teammates will love it.
- **Wow demo:** Pour fresh margine into the chamber → LED visibly brightens within 30 s as the biofilm activates.
- **Risk:** Voltages tiny (~0.5 V), MFCs need pre-incubation (start the cell on Day 0 if rules allow).
- **Score: 8/10** — niche but heart-grabbing.

### 🌀 W7 — "GeniusFridge" — Cold-chain blackout-resilience AI
> "When the next STEG blackout hits Sfax at 3pm, GeniusFridge tells you exactly which restaurant inventory will spoil — and pre-stages cooling so it doesn't."

- **Concept:** Stick a thermocouple + door-event sensor on a fridge; small ML model trained on outage history predicts "spoil minute" per shelf; voice/SMS alerts pre-fire to staff. Can pre-cool aggressively when blackout-likelihood crosses a threshold.
- **Trend stack:** Time-series forecasting + edge ML + crowdsourced outage data + alerting
- **Why it's special:** Solves a real, painful, *measurable in TND* problem (cold-chain losses for SMEs). Hotels, clinics, restaurants, pharmacies all care.
- **Wow demo:** Pull the fridge plug live; dashboard counters start: "spoilage in 47 min if no power." Plug back in, counters reset. Drop a virtual blackout in a city map → ML pre-cools.
- **Risk:** Demo requires patience (fridges are slow); use a Peltier-cooled box as a proxy.
- **Score: 7.5/10** — high product-market-fit, judges with SME exposure will love it.

### 🌀 W8 — "PhosphoMine" — Energy-aware optimization for Gabès phosphate plants
> "GCT phosphate plants in Gabès consume ~3% of Tunisia's total electricity. We use AI + chem-eng pinch analysis to cut their energy bill by 15%."

- **Concept:** Streamlit app loads a hypothetical GCT phosphoric-acid plant stream table → runs OpenPinch → recommends heat-integration retrofits → AI agent translates into a TND payback estimate. Bonus: hook to a (mock) carbon credit calc.
- **Trend stack:** Pinch analysis + agentic AI + simulation + Tunisia industrial intelligence
- **Why it's special:** Industrial energy is the *biggest* lever in Tunisia (industry = 35% of consumption, GCT alone = 3%). Pure chem-eng moat — CS team won't even know what a stream is.
- **Wow demo:** Slider adjusts minimum approach temperature; grand composite curve morphs live; TND/year savings counter spins.
- **Risk:** No hardware = lower defensibility against a pretty CS dashboard. Fix by recording a "real" interview with a chem-eng prof endorsing the model.
- **Score: 7.5/10** — best industrial-impact play.

### 🌀 W9 — "SunProof" — Insurance underwriting for rooftop PV
> "PROSOL just opened solar loans to 65,000 households. Banks have no historical data to price the risk. SunProof predicts 25-year energy yield from satellite + IoT monitoring, and prices the policy in real time."

- **Concept:** Vision model on Sentinel-2 (free) tiles classifies roof orientation/tilt/shading → predicts annual yield with PVGIS API → IoT live data progressively refines the estimate → smart-contract or REST API quotes a per-kWh insurance premium.
- **Trend stack:** Multimodal LLM + satellite imagery + IoT + fintech + Tunisian policy hook
- **Why it's special:** Direct line to PROSOL Élec économique; banks (BIAT, Attijari, BNA) actively want this. *Real* commercial pull.
- **Wow demo:** Drag a pin on a Tunisian map → instant satellite-derived yield estimate + insurance quote.
- **Risk:** Sentinel-2 API requires a free account; pre-cache 3 demo Tunisian addresses.
- **Score: 8.5/10** — strongest fintech-energy hybrid that's *not* crypto.

### 🌀 W10 — "QalbBattery" — Cardiac analogy for battery health (storytelling moonshot)
> "Your battery has a heartbeat. We auscultate it like a stethoscope — and predict its death like a cardiologist."

- **Concept:** Frame the EIS-Lite + Thermal Runaway suite as a "battery cardiologist" — ECG-style live waveform of voltage ripple, "heart rate variability" = SoH score, anomaly detection = "arrhythmia alert." Narrative is medical, technical content is electrochemical.
- **Trend stack:** Re-skinned W1 (AthenaGrid) with a brand
- **Why it's special:** The framing makes a technical product *unforgettable*. Judges will remember "the cardiology team" 6 months from now.
- **Wow demo:** Cell on screen pulses to a heartbeat sound, vitals chart scrolls; team injects "stress" (heat) → BPM rises → "cardiac event imminent" alarm.
- **Risk:** If the underlying tech is weak, the metaphor reads as gimmick. Land the chemistry first; layer the brand on top.
- **Score: 7/10 raw, 9/10 if execution sharp** — pure storytelling lever.

---

## Part 11 — Sponsor-Bait Map

Different sponsors care about different things. Each top idea hits different ones. Use this to pick angles in the pitch.

| Sponsor / Judge type | What they care about | Best ideas for them | Pitch language to use |
|---|---|---|---|
| **IEEE PES** (Power & Energy Society) | Grid integration, renewables, demand-response, smart-grid standards | SoukWatt, ScenarioForge, AthenaGrid, H2-Sentinel | "IEEE 2030 interoperability… day-ahead dispatch… N-1 contingency…" |
| **IEEE PELS** (Power Electronics Society) | Inverters, MPPT, EV charging, battery management, converters | AthenaGrid, Thermal Runaway, H2-Sentinel, SoukWatt nodes | "Buck-boost topology… SoC/SoH estimation… BMS architecture…" |
| **STEG / ANME** (utility + efficiency agency) | Reducing peak demand, smart-meter rollout, PROSOL programmes | STEG Whisperer, GeniusFridge, SunProof, SnapMeter | "PROSOL Élec économique… tranche cliff… M&V baselining…" |
| **TE H2 / ACWA Power / SoutH2** (hydrogen players) | Green H2 production economics, electrolyzer efficiency, export readiness | H2-Sentinel + AthenaGrid fusion | "Faradaic efficiency… membrane degradation… export-grade purity…" |
| **CRTEn / ENIT / academia** | Publishable contributions, novelty, rigor | AthenaGrid (PINN), ScenarioForge (DDPM+GNN), STEG Whisperer (synthetic data) | "Novel loss formulation… benchmark improvement… reproducibility…" |
| **Telcos** (Ooredoo, Tunisie Télécom, Orange — possible sponsors) | IoT connectivity, NB-IoT/LoRaWAN deployments, B2B revenue | TinyML NILM, EdgeFleet, PaySun (mobile-money rails) | "LoRaWAN payload optimization… edge-to-cloud architecture…" |
| **Banks** (BIAT, Attijari, etc. — fintech-curious) | Credit risk for green loans, ESG reporting, new financial products | SunProof, SolREC-Tn, PaySun, kWhUSD | "Underwriting at the panel level… ESG verification… retail green bonds…" |
| **Wattnow / local cleantech startups** (likely mentor/judge pool) | B2B SaaS for energy management, scalable IoT, dashboards | GeniusFridge, SnapMeter, PhosphoMine | "Multi-tenant dashboards… white-label energy intelligence…" |
| **GIZ / Mitigation Action Facility** (German cooperation, possible institutional sponsor) | Climate, just transition, capacity-building | OliveBatt, PhosphoMine, PaySun, SunProof | "Just transition… SDG 7 alignment… capacity building…" |

**Tactic:** in your pitch deck, dedicate one slide ("Stakeholder Map") that explicitly names 3–4 of these and shows how the project hits each one. PES judges *love* explicit alignment.

---

## Part 12 — FILLED Scoring Matrix (Top 7)

Scores 1–5 across five axes (higher = better). My read; calibrate with team.

| # | Project | HW sourceable by 30 Apr | Chem/bio engagement | Demo failure survivable | Tunisian "feels personal" | AI defensible under Q&A | **Total /25** |
|---|---------|---|---|---|---|---|---|
| 🥇 W1 | **AthenaGrid** (PINN battery + agentic + MCP) | 5 (just need 18650s) | 5 (Arrhenius/heat eq.) | 4 | 3 | 5 (PINN is real moat) | **22** |
| 🥈 | **H2-Sentinel** (electrolyzer twin) | 3 (PEM cell ETA risk) | 5 (electrochem) | 3 (no cell = no demo) | 4 (H2 export story) | 4 | **19** |
| 🥉 W2 | **STEG Whisperer** (offline SLM) | 5 (Pi 5 + USB mic) | 2 (limited bio role) | 5 (pure software) | 5 (sovereign AI, AR/FR) | 4 | **21** |
| 4 F2 | **SoukWatt** (P2P microgrid) | 4 (3× ESP32 easy) | 3 (some role) | 4 | 3 (regulatory caveat) | 4 | **18** |
| 5 | **Thermal Runaway Sentinel** | 5 (LiPo free) | 5 (SEI chemistry) | 4 (no fire = OK) | 3 | 4 | **21** |
| 6 W5 | **RL Twin** (Sinergym + Peltier + voice) | 4 (Peltier easy) | 3 | 3 (RL fragile) | 4 | 4 | **18** |
| 7 F3 | **PaySun** (PAYGo solar + D17) | 4 (relay + pump) | 2 | 4 | 5 (huge story) | 3 | **18** |

**Bonus:**
- W7 GeniusFridge: 5/3/4/5/3 = **20**
- W9 SunProof: 5/2/5/5/4 = **21** (dark horse — note the high score)
- W6 OliveBatt: 3/5/3/5/3 = **19**
- W8 PhosphoMine: 5/5/5/3/3 = **21** (industrial-impact dark horse)

**Top 4 by total:** AthenaGrid (22) > STEG Whisperer / Thermal Runaway / SunProof / PhosphoMine (all 21). Fascinating — the highest scores cluster around ideas that don't depend on the PEM cell arriving.

---

## Part 13 — Pitch Narrative Hooks (the opening 30 seconds)

The opening line decides the next 5 minutes. Each top idea gets a written hook — pick the team's voice, refine in the meeting.

### AthenaGrid
> "L'incendie d'une batterie Li-ion atteint 800°C en 90 secondes. Personne ne le voit venir — sauf la chimie, qui le sait toujours. AthenaGrid fait parler la chimie, par un agent IA qui négocie avec le pack."

### H2-Sentinel
> "En 2050, la Tunisie veut exporter 8.3 millions de tonnes d'hydrogène vert par an. Mais aujourd'hui, on ne sait même pas mesurer en temps réel l'efficacité d'un électrolyseur sans un labo à 50,000 €. H2-Sentinel le fait avec un capteur à 5 dollars."

### STEG Whisperer
> "Ma grand-mère à Sousse reçoit sa facture STEG par papier. Elle ne sait pas qu'elle vient de franchir la tranche 3, et que sa machine à laver lui coûte désormais 400 millimes/kWh. STEG Whisperer parle son arabe, lit sa facture, et la prévient avant qu'elle ne paie."

### SoukWatt
> "Trois étudiants à INSAT, trois panneaux solaires, un seul réseau campus. Au lieu de revendre l'excédent à STEG à perte, ils se le vendent entre eux — réglé en 15 minutes par smart contract. C'est SoukWatt — le souk de l'énergie."

### Thermal Runaway Sentinel
> "Chaque mois, un pack lithium-ion explose quelque part dans une trottinette tunisienne. Le coupable: la SEI qui se décompose à 90°C — un signal qu'aucun BMS commercial ne lit. Notre Sentinel le lit, prédit l'emballement 60 secondes à l'avance, et coupe le circuit avant la flamme."

### RL Twin
> "Un climatiseur d'hôtel à Hammamet coûte plus cher que le salaire du veilleur de nuit. Notre agent par renforcement apprend à le piloter dans une simulation de 4 heures, puis se déploie sur le vrai en 30 secondes — économie 28%, sans toucher au confort."

### PaySun
> "Ahmed cultive la pastèque à Kebili. Il ne peut pas s'offrir une pompe solaire à 800 dinars d'un coup, et personne ne lui prêtera. Avec PaySun, il paie 8 dinars/semaine via D17. S'il rate, sa pompe se verrouille. S'il paie, l'eau coule. Inclusion financière + énergie verte, en un seul boîtier."

### GeniusFridge
> "À 14h47 le 12 août dernier, Sfax a perdu le courant. À 17h22, 12 restaurants ont jeté 2.4 tonnes de viande. GeniusFridge prédit la coupure, pré-refroidit le frigo, et alerte le chef avant que le thermomètre ne crie."

### SunProof
> "PROSOL vient d'ouvrir un crédit solaire à 65,000 ménages. La BIAT n'a aucune donnée historique pour pricer le risque. SunProof regarde le toit du satellite, suit le panneau en IoT, et prix la prime d'assurance en temps réel."

### PhosphoMine
> "Le Groupe Chimique Tunisien consomme 3% de toute l'électricité du pays. Avec une analyse de pinch et un agent IA, on lui économise 15% — soit l'équivalent énergétique de 12,000 ménages tunisiens."

---

## Part 14 — Competitive Landscape (what other teams will pitch)

**Predict the room.** Most teams at NRTF 3.0 will likely converge on these clichés:

| Cliché project | Why teams will build it | How to **beat** them |
|---|---|---|
| "Solar load forecasting dashboard" with LSTM/Prophet | Easy, every Kaggle tutorial covers it | Use Chronos/TimesFM zero-shot — show *foundation models* beat their custom LSTM with one Python line |
| "Smart home energy app" with mock data | Pretty UI, no substance | Bring real hardware (NILM TinyML on a CT clamp) and stream live |
| "Blockchain energy trading" with no hardware | Web3 hype | SoukWatt with 3 *physical* ESP32 nodes + visible energy flowing |
| "EV charging station finder" map | Easy MVP, no domain depth | Don't go here — overcrowded |
| "Chatbot for X" (energy advice / bill query) | LLM API + Streamlit = 4h work | STEG Whisperer with offline Gemma 4 + Tunisian Arabic = unbeatable on this axis |
| "IoT for HVAC" with rule-based control | Easy, looks decent | RL Twin with Sinergym sim-to-real beats them on technical depth |
| "Carbon footprint calculator" | Common, no novelty | SunProof or SolREC-Tn with on-chain attestation |
| "Anomaly detection on smart meter" with isolation forest | Done a thousand times | AthenaGrid with PINN + agentic *explanation* dominates |

**Differentiation principles** judges will subconsciously reward:
1. **Hardware on the table** > slides
2. **Live data** > mock data
3. **Physics in the ML** > pure data-driven
4. **Local Tunisian context** > generic global
5. **Sovereign / offline** > cloud-dependent
6. **Agentic / interactive** > one-shot output
7. **Multi-stakeholder pitch** > single-actor

Every top-7 idea here was selected to dominate on at least 4 of these 7.

---

## Part 15 — Failure-Mode Analysis & Fallbacks

For each top finalist, what kills it on stage and what's the recovery?

| Project | Most likely failure | 30-second recovery |
|---------|---------------------|---------------------|
| **AthenaGrid** | INA219 readings noisy, PINN diverges live | Pre-record a perfect run as backup video; switch to "trained run" demo with dry narration |
| **H2-Sentinel** | PEM cell late or DOA on stage | Switch to *simulated* electrolyzer (Python physics model); demo stays in dashboard. Pre-record real runs from Day 0 if cell arrives |
| **STEG Whisperer** | Whisper mishears Arabic prompt | Have 3 pre-recorded queries on a button; play those if live mic fails |
| **SoukWatt** | One ESP32 dies mid-demo | Design with 3 nodes but only need 2 working (auction still clears with 2 bidders) |
| **Thermal Runaway** | Organizers ban open heating; OR battery vents on stage (worst case) | Use a non-battery heater (resistor + thermistor) to demo the *prediction model*; same pitch, no fire |
| **RL Twin** | RL agent takes too long to converge live | Pre-train offline; on-stage demo loads pretrained policy — 5 sec deployment "ta-da" |
| **PaySun** | D17 sandbox API down | Mock the webhook from a button click; same visual outcome |
| **GeniusFridge** | Fridge too slow to show change | Use a Peltier-cooled lunchbox as proxy; faster thermal response |
| **SunProof** | Sentinel-2 API rate-limits | Pre-cache 5 demo Tunisian addresses with their imagery + yield curves |
| **PhosphoMine** | Pure-software demo lacks visceral pull | Print a "before/after" Sankey diagram poster; tape it to the demo desk for tactile reference |

**Universal rule:** record a **2-minute video** of every demo working perfectly the night before. If anything fails on stage, play the video.

---

## Part 16 — Pre-Hackathon Learning Checklist (April 25–30)

Each teammate has 6 days. Distribute this:

### Talel (SW/AI lead)
- [ ] Read Anthropic MCP docs (1h): https://modelcontextprotocol.io/
- [ ] Run Chronos-Bolt zero-shot on a STEG-like CSV (45 min): https://github.com/amazon-science/chronos-forecasting
- [ ] Spin up LangGraph agent with 3 tools (1h tutorial)
- [ ] Install Ollama + Gemma 4 e2b locally (test SLM responsiveness)
- [ ] Skim PINN tutorial for batteries: https://github.com/maziarraissi/PINNs
- [ ] Decide: FastAPI vs Streamlit for the dashboard (Streamlit wins for 24h)

### Roommate (SW/AI #2)
- [ ] Set up GitHub org + monorepo skeleton
- [ ] Practice Hardhat local chain + ERC-1155 mint script (if fintech path)
- [ ] Get familiar with MQTT broker (Mosquitto) + Node-RED for IoT data piping
- [ ] If Whisper path: install whisper.cpp, test Arabic + French audio
- [ ] If voice path: install Piper TTS + record a French sample voice

### IIA teammate (embedded lead)
- [ ] Verify ESP32 toolchain works (Arduino IDE or PlatformIO) on his machine
- [ ] Test INA219 + ADS1115 + DHT22 + relay individually on a breadboard
- [ ] If H2 path: solder MQ-8 onto perfboard; calibrate with known H2 leak proxy (lighter gas = methane will cross-react = fine for demo)
- [ ] If battery path: build the heater rig safely (heater + thermistor + relay)
- [ ] Set up MQTT broker on Pi or a laptop
- [ ] Practice Modbus simulator (modbus-cli or PyModbus) for the MCP server demo

### Chem/Bio teammate #1
- [ ] Lead author on the chemistry slides:
  - If AthenaGrid: SEI breakdown, Arrhenius, 1D thermal model of an 18650
  - If H2-Sentinel: Faradaic efficiency, overpotential, Nafion membrane physics
  - If OliveBatt: MFC anode chemistry, biofilm formation
- [ ] Source any specialty consumables (electrolyte, distilled water, lime, yeast — depending on path)

### Chem/Bio teammate #2
- [ ] Lead author on the *Tunisian-impact* slides:
  - STEG context, ANME / PROSOL framework, FNME funding levers
  - Local case study (e.g., GCT for PhosphoMine, Kebili for PaySun, Sousse household for STEG Whisperer)
- [ ] Practice the 30-second French opening hook (most pitchable Tunisian voice on the team)

**Whole team:**
- [ ] One Zoom/in-person meeting Sunday April 26 to lock the project + assign final roles
- [ ] One full dry-run of the pitch Wednesday April 29 (record it, watch it back)

---

## Part 17 — Awards Strategy (if NRTF 3.0 has sub-prizes)

Some hackathons award sub-categories: best AI, best hardware, best social impact, best presentation, audience choice. Match your project to maximize multi-prize potential:

| Sub-prize (likely) | Best fit | Why |
|---|---|---|
| **Best AI / ML** | AthenaGrid, ScenarioForge | PINN + agentic + MCP = visible technical depth |
| **Best Hardware** | Thermal Runaway, SoukWatt, OliveBatt | Real circuits, real measurement, real risk |
| **Best Social Impact** | PaySun, STEG Whisperer, SunProof | Inclusion, sovereignty, financial access |
| **Best Sustainability** | OliveBatt, PhosphoMine, H2-Sentinel | Quantified TND/CO2 saved, real industrial relevance |
| **Best Presentation** | Any with strong narrative hook (Part 13) | Practice the French opener cold |
| **Audience Choice** | RL Twin (live demo theatre), Thermal Runaway (drama), STEG Whisperer (relatable) | Visceral demos win crowd votes |
| **Sponsor-specific** (e.g., "Best PES alignment") | SoukWatt, ScenarioForge | Explicit grid-integration narrative |

**Strategy:** pick a project that can credibly compete in *at least 2* sub-categories. Top scorers on this axis: **AthenaGrid (AI + Sustainability), STEG Whisperer (AI + Social Impact + Audience), Thermal Runaway (Hardware + Audience), H2-Sentinel (Hardware + Sustainability + Sponsor).**

---

## Part 18 — A "Secret Weapon" Cheatsheet

Things most teams won't bother with that judges *love*:

1. **A printed one-page tech sheet** (architecture diagram + 1 equation + KPI numbers) handed to each judge. Most teams forget physical paper exists.
2. **A live API endpoint** the judges can `curl` from their phones — proves it actually runs.
3. **A French-language README** in the GitHub repo (most teams default to English; the contrast matters for Tunisian judges).
4. **A "pitch in 30 seconds, in 2 minutes, in 5 minutes" — practiced**. Judges may interrupt and ask for the elevator version.
5. **Naming a Tunisian academic paper** in the related-work slide (5 minutes of `scholar.google.com "INSAT" energy 2025` finds 10 candidates).
6. **A "what we'd do with another 24 hours" slide** at the end — shows roadmap thinking, not feature-completeness obsession.
7. **A live cost estimator**: "this MVP cost us 380 TND in parts — production at scale would be X TND/unit." Concrete BoM math impresses engineers.
8. **One Tunisian Arabic phrase** in the opening hook (even if the rest is in French) — code-switching signals belonging.
9. **A teammate as designated Q&A handler** — pre-assign who answers AI questions, who answers chemistry, who answers business. Don't all rush the mic.
10. **A backup laptop with the demo running** in case the primary crashes. Teams forget this every single time.

---

## Part 19 — Hybrid / Portfolio Plays

If the team can't agree on one idea, consider unifying two under a brand:

### "BatterySafe" = AthenaGrid + Thermal Runaway
One product that tracks SoH (PINN) AND predicts thermal runaway. Pitch: "every Li-ion deserves both a cardiologist and a fireman." Strong for PELS judges focused on BMS.

### "AgriEnergy Suite" = PaySun + Solar Pump Scheduler + Tranche-Aware Coach
One mobile-first product for Tunisian farmers: PAYGo financing + PV-aware pump scheduling + bill optimization. Strong for social-impact and agricultural sponsors.

### "GreenOps for SMEs" = GeniusFridge + PhosphoMine + Pinch-as-a-Service
B2B SaaS for Tunisian SMEs: cold-chain resilience + industrial pinch + dashboards. Best for fintech and energy-services sponsors.

### "Sovereign AI for Energy" = STEG Whisperer + EdgeFleet
Offline, on-device, multilingual energy intelligence. Single brand, two demos. Best for "digital sovereignty" narrative.

**Caveat:** portfolios dilute focus. Only do this if the team is split 3-2 and we need a compromise. Single-product pitches usually win.

---

## Part 20 — The "Talel Strategist" Playbook (for the lead-pitcher / project-manager)

You're going to be the de-facto PM (you brought the team here, you've done the research). Here's a 24-hour management playbook:

**Hour 0 (project announced):**
- Don't sprint to code. Spend 60 minutes locking scope. Use the scoring matrix.
- Assign one *primary owner* per layer: hardware (IIA), chemistry (Bio #1), AI core (Talel), web/dashboard (Roommate), pitch + Tunisian context (Bio #2).
- Set a hard deadline: hardware integration end of hour 12, polish + pitch hour 18-22, sleep + dry-run hour 22-24.

**Hour 0–4: Scaffolding (PARALLEL)**
- IIA wires breadboard, gets one sensor reading streaming
- Talel + Roommate build the data-pipeline skeleton (MQTT → file → simple model)
- Bio teammates draft the slide deck shell (Title / Problem / Tunisian Context / Solution / Demo / Stakeholder Map / Ask)

**Hour 4–8: First end-to-end run**
- Sensor → backend → dashboard with **fake** data. Verify the pipe is alive.
- Bio teammates start building the *real* hardware setup (PEM cell, MFC, greenhouse, whatever it is)

**Hour 8–14: Real data + ML**
- Switch dashboard to live data
- Train/load the ML model (use pretrained foundation model where possible — saves 4 hours)
- Bio teammates rehearse the chemistry explanation

**Hour 14–18: Polish**
- Pretty up the dashboard (one good Tailwind theme + one Recharts plot beats five mediocre ones)
- Run every demo flow 3 times; record video of best run
- Pitch outline finalized

**Hour 18–22: Dry runs**
- 3 full pitch run-throughs with Q&A
- Each teammate practices their assigned answer
- Print the one-pager; pack the backup laptop

**Hour 22–24: Sleep + breakfast**
- The team that pitches well-rested beats the team that pitches with a working but ugly demo and red eyes. Sleep matters.

**The hidden rule:** the hackathon isn't won during the build — it's won during the **last 4 hours of polish + pitch prep**. Most teams burn that window on bug-fixing. Don't.

---

*Document v2 — generated April 24, 2026, extended with Parts 10–20. Combine with v1 for full strategy picture.*

