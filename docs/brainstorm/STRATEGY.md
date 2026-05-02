# Re·Tech Fusion — Master Strategy

> **The single source of truth.** When in doubt, this file wins. When the spec says one thing and we said another in chat, this file gets updated *first*, then code follows.
>
> **Hackathon:** Re·Tech Fusion (RETF) — Industrial AI & IoT — INSAT, University of Carthage
> **Dates:** May 1–3, 2026 (we are inside Day 1 right now)
> **Theme:** End-to-end industrial energy intelligence — from raw IoT sensors to predictive modeling, anomaly detection, document extraction, CO₂ estimation, and waste-heat recovery.
> **Team:** 5 — Talel + roommate (software/AI), 1 IIA student (industrial automation / embedded), 2 chemical/biological engineering students.
> **Goal:** First place. The pitch session weights coherence and depth. Numbers, real demo, French/English/Tunisian Arabic delivery.

---

## 0. The challenge in one paragraph

Industrial sites manage multiple plants, acquired subsidiaries, and heterogeneous energy data. Today, consolidating that data for CO₂ calculations is slow, manual, and error-prone. Re·Tech Fusion asks teams to build an **end-to-end intelligent system**: raw IoT sensor data → unified data pipeline → document extraction → unit normalization → CO₂ estimation → anomaly detection → dashboard → edge resilience → waste-heat recovery prioritization. Three parts, scored independently; top teams pitch on Day 3 morning.

We have an unusual asset: a real **energy audit of a Tunisian pharmaceutical factory** (15-page French PDF), 33 photos of bills + 5 large scanned-PDF batches, and 22 monthly tri-generation Excel reports — all uploaded by Talel before the official test set drops. **We use this as practice data.** Anyone who shows up at H+0 of Part 2 with a working pipeline against this data is two hours ahead of every team starting from zero.

---

## 1. Spec recap (canonical timeline + scoring)

### Timeline

| When | What |
|---|---|
| Day 1 — 14:00 | Opening Ceremony |
| Day 1 — 23:00 | **Part 1 announced** |
| Day 2 — 14:00 | Part 1 submission deadline |
| Day 2 — 00:00 | **Part 2 + Part 3 announced** (Part 2 deadline same time = Day 3 00:00) |
| Day 3 — 05:00 | Part 3 submission deadline + 1-hour grace period starts |
| Day 3 — 07:00 | Presentation submission deadline |
| Day 3 — 09:00 | Pitching session begins (top teams only, 8 min + 7 min Q&A) |

### Scoring (what we're optimizing)

| Part | Points | Bonus | Owner inside the team |
|---|---:|---:|---|
| **Part 1 — IoT Device & Protocol** | 95 | +15 | IIA + roommate (server) |
| **Part 2 — Pipeline, Unification, Modeling** | 120 | +40 | Talel + roommate + chem/bio (units / CO₂) |
| **Part 3A — Edge Inference & On-Device Anomaly** | 75 | +15 | IIA + Talel (model port) |
| **Part 3B — Waste Heat Recovery Design** | 75 | +15 | Chem/bio #1 + chem/bio #2 |
| **Pitch** | 60 | — | Whole team; Talel + chem/bio #2 lead |

We commit to **Track B as primary** (chem/bio leverage + audit data already in hand) and attempt **Track A as stretch** on Day 3 morning if we have model + ESP32 capacity. Doing both is +75 pts; Track A alone has hard hardware-port risk we can mitigate by leaning on Track B.

---

## 2. Architecture (one-screen view)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  PART 1 — Sensor stand                                                       │
│  ESP32 → 3+ sensors → MQTT (or HTTP POST) → Mosquitto → backend ingest       │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ MQTT 1883 / WebSockets 9001
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  apps/backend (NestJS + Fastify + Prisma + TimescaleDB + Mosquitto client)   │
│   ├─ devices module           (registry, API keys)                           │
│   ├─ readings module           (TimescaleDB hypertable, 1-min rollups)       │
│   ├─ events module             (anomaly events from on-device + server)     │
│   ├─ extracted-records module  (one row per extracted bill / Excel row)     │
│   └─ ai-bridge module          (calls AI orchestrator)                       │
└──────┬─────────────────┬──────────────────┬──────────────────┬───────────────┘
       │ HTTP            │ WebSocket        │ HTTP             │ HTTP
       ▼                 ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────┐
│ apps/        │  │ apps/frontend    │  │ apps/ai-agents   │  │ apps/doc-extraction │
│ ml-pipeline  │  │ (Next.js +       │  │ (LangGraph: ext, │  │ (FastAPI:           │
│ (FastAPI:    │  │  Recharts):      │  │  norm, CO₂,      │  │  bills / excel /    │
│  forecast,   │  │  KPIs, sankey,   │  │  forecast,       │  │  audit / submit)    │
│  anomaly)    │  │  trends, alerts) │  │  anomaly,        │  │                     │
│              │  │                  │  │  Track-B advisor)│  │                     │
└──────┬───────┘  └──────────────────┘  └────────┬─────────┘  └─────────┬───────────┘
       │                                         │                       │
       ▼                                         ▼                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ apps/edge-runtime    — quantize forecast model → TFLite-Micro for ESP32      │
│ apps/heat-recovery   — Track B: identify, characterize, score, ROI top-3     │
└──────────────────────────────────────────────────────────────────────────────┘
```

All Python services run with `uvicorn` on different ports; backend orchestrates; frontend is the demo surface. Docker compose brings the whole thing up.

---

## 3. Part 1 — IoT Device & Protocol (95 + 15 pts)

### Goal

A working ESP32 device that reads ≥ 3 distinct sensor types and pushes them reliably (MQTT preferred, HTTP fallback) to a server on a teammate's PC. Reconnection without data loss is a "+15 advantage" per the spec.

### Sensor stand (committed)

We have on hand: a **flow sensor**, a **heat (temperature) sensor**, a **microwave/radiowave sensor**, plus simple supporting parts. Final triplet:

| # | Sensor | Wiring | What it measures | Why it earns points |
|---|---|---|---|---|
| 1 | **Flow sensor** (e.g. YF-S201 hall-effect, or gas flow) | digital pulse (interrupt pin) | water/gas flow rate (L/min) → energy proxy | Distinct sensor type; matches "power consumption" / process throughput |
| 2 | **Heat / temperature sensor** (DS18B20 OneWire, or K-thermocouple via MAX6675/MAX31855) | OneWire / SPI | pipe / exhaust / fluid temperature (°C) | Distinct; energy-relevant for heat recovery |
| 3 | **Microwave / radiowave sensor** (RCWL-0516 doppler, or RCWL-9620 / similar) | digital out (presence) or analog (level / distance) | presence / motion / level | Distinct sensor type; gives us a non-thermal modality |
| Stretch | **BME280** (T / RH / P) over I²C, or current clamp (SCT-013-030 + INA219) over I²C | extra modality for the bonus | | |

Ranges + default `valid_range` (for the Part 1 §"Data quality" 10 pts):

```
flow_lpm:    0.1 .. 50.0
temp_c:     -10.0 .. 200.0
microwave:   {0, 1}   (presence) or 0.0 .. 5.0 m (level)
humidity:    0.0 .. 100.0
pressure:    900.0 .. 1100.0  (hPa)
```

### Protocol

**MQTT primary** (Mosquitto on a teammate's PC), **HTTP POST fallback** (FastAPI side-car if MQTT fails). Topic taxonomy already in `iot-mqtt-pipeline` skill:

```
retf/<deviceId>/telemetry/<metric>     # uplink readings
retf/<deviceId>/event/<type>           # uplink events (anomaly, fault)
retf/<deviceId>/cmd/<action>           # downlink commands
retf/<deviceId>/status                 # online/offline retained heartbeat
```

Payload: `{"v": float, "ts": iso8601, "seq": int, "unit": "lpm"|"degC"|...}`. QoS 1 telemetry, QoS 2 commands. LWT = `"offline"` on `status`.

### Reliability features (the +15 bonus)

- **Reconnection w/o data loss** — local SPIFFS / NVS ring buffer of unsent readings; replay on reconnect with same `seq`. Backend dedupes on `(device_id, metric, seq)`.
- **TLS / HTTPS** — optional; only if we have time at H+10 of Part 1.
- **OTA update** — Arduino-OTA library; takes ~30 min if we want it.
- **Device-side buffering** — already covered by the ring buffer above.
- **Custom sensor** — the microwave/radar sensor is unusual enough to count.

### Server

NestJS already scaffolded. Mosquitto in `infra/docker/`. We add:
- `subscribe('retf/+/telemetry/+')` → parse → Pandera-validate → `INSERT readings`.
- `subscribe('retf/+/event/+')` → `INSERT events`.
- WebSocket bridge → frontend live chart.
- Continuous aggregates 1-min / 1-hour for the dashboard.

### What gets us the easy 70 pts (must-haves)
- 30 pts — server receives valid data ✓
- 25 pts — 3 distinct sensor types, all active simultaneously ✓
- 15 pts — reconnection handling ✓
- 15 pts — uptime ≥ 95% over 5-min windows ✓
- 10 pts — data quality (no `null`, no `-999`, all in range) ✓

### Bonus 15 pts target
- Custom microwave sensor + OTA + device-side buffering → easy +15.

---

## 4. Part 2 — Pipeline, Unification & Modeling (120 + 40 pts)

This is the **core of the challenge** — almost half the total points. Don't shortchange it.

### What the test set will look like (we already have a representative practice set)

- **Heterogeneous documents:** PDF invoices, scanned bills (JPEG), multi-sheet Excel files. Mixed units (kWh, MWh, Gcal, BTU, toe, GJ).
- **Ground-truth annotation** for prediction-model validation.
- **IoT readings** from Part 1 (we may need to record our own ground-truth).
- **Hidden anomalies** in the values dataset (optional bonus).

We have practice data already staged at:
- `data/raw/audit/rapport_audit.pdf` — 15-page French audit of a pharma factory (tri-gen + STEG + gas + 3 zones).
- `data/raw/factures/` — 33 JPEGs + 5 PDFs of real bills.
- `data/raw/tri-gen/` — 22 Excel monthly reports July 2025 → April 2026.

### Part 2 sub-deliverables (with our owners)

**§2.1 Extraction & unification (40 pts)** — `document-intelligence-engineer` lead.
- File typing (native PDF / scanned image / Excel) → branch.
- Native PDF: pdfplumber + Camelot for tables.
- Scanned: preprocess (deskew / denoise / threshold) → PaddleOCR `lang=fr` → LLM-assisted field extraction with Pydantic schema.
- Excel: openpyxl + Polars + LLM-assisted header detection.
- Two-pass: extract → validate (cross-field math: `total_ht + tva ≈ total_ttc`, period ordering).
- Cache by SHA. Failures to a parquet bucket.

**§2.1 Unit normalization (25 pts)** — `energy-domain-engineer` lead.
- One canonical unit: **kWh**.
- `to_kwh(value, unit)` constants module with provenance.
- Refuses unknown units (don't guess).

**§2.1 Merging with IoT (jointly counted in §2.1)** — `data-engineer`.
- Single Polars DataFrame keyed on `(site_id, ts, carrier, source_doc_id, sensor_id)`.
- Partitioned Parquet by `(supplier, year_month)` and `(device_id, date)`.

**§2.2 CO₂ estimation (15 pts)** — `energy-domain-engineer`.
- Per-row: carrier → emission factor (ADEME / STEG / IEA) → `co2_kg`, `scope`.
- Aggregate: tCO₂/yr, per-carrier sankey, per-month time series.
- Reconcile against energy balance ± 5%.

**§2.2 Forecasting (counts in CO₂ block)** — `ml-engineer`.
- Foundation-first: try Chronos-Bolt-tiny zero-shot on the IoT + monthly Excel series.
- If Chronos underperforms: LightGBM with cycle features (hour, dow, month-of-year).
- Multi-horizon: 24h ahead + 7d ahead.

**§2.2 Anomaly detection (+15 bonus)** — `ml-engineer` + `data-engineer`.
- Server-side: rolling-MAD z-score, STL + IsolationForest on residuals, dropout/stuck/spike detectors.
- Each event: `{type, ts, sensor/site, confidence}`.

**§2.3 Dashboard (20 pts) + Docker (20 pts) + bonus innovation (+25)** — `frontend-designer` + `roommate`.
- Next.js + shadcn/ui + Recharts (Plotly for sankey).
- KPIs: total kWh, tCO₂, anomalies/day, top-1 anomaly description, energy-balance closure %.
- Live IoT chart (WebSocket).
- Sankey of energy flows (gas → tri-gen / boilers → outputs / losses).
- Anomaly feed.
- Track B scenarios table (preview).
- `docker compose up` cold-starts the whole thing.

### Submission flow

The spec says: "POST your extraction results as JSON — platform returns F1 scores instantly. Same with anomaly / CO₂ estimate." We have a `submission-platform-client` skill ready; configure URL + token at H+0 of Part 2.

---

## 5. Part 3 — Edge Intelligence OR Heat Recovery (75 + 15 pts each)

### Track B (PRIMARY) — Waste-heat recovery design

**Why this is our floor:** chem/bio teammates lead, audit data already in hand, low hardware risk, math + writing dominant.

**Deliverable:**
1. Heat-source inventory (≥ 8 sources from the audit).
2. Characterization: `Q_recoverable [kW]`, T-level, hours/yr, location.
3. MCDA score (energy 30 / CO₂ 25 / complexity 20 / capex 15 / payback 10).
4. **Top-3 scenarios** with bracketed ROI (best / base / conservative).
5. Bonus: interactive notebook + scored xlsx + sankey before/after.

**Ready-now sources from `rapport_audit.pdf`** (Section I-3 + I-4 already name them):
- Boiler chimney flue gas (5–10 % of gas not recovered) — high priority
- Steam condensate not returned to feedwater — easy win
- Compressed-air heat-of-compression (~ 80 °C) — ECS pre-heat
- Hot-surface losses (uninsulated valves, boiler bodies) — insulation upgrade
- Tri-gen exhaust beyond current jacket recovery — extension scenario
- Refrigeration condenser heat (winter only) — low-grade
- Absorption-chiller jacket water (already tied) — possible extension
- Munters dehumidifier exhaust — sometimes overlooked

**Owner:** `energy-domain-engineer` agent (logic), chem/bio teammates (numbers + narrative).

### Track A (STRETCH) — On-device anomaly + prediction

**Why stretch:** ESP32-only port of the Part 2 forecaster. Risk: model size + latency. Reward: +75 pts.

**Plan:**
1. Train the simplest possible multivariate predictor in Part 2 (LightGBM or a tiny MLP, 8-32 inputs, 1-step ahead).
2. Convert to TFLite INT8 via `ai_edge_torch`.
3. Run residual-z-score anomaly on-device: `|y - y_hat| / σ > 3`.
4. Constraint check: model ≤ 200 KB, latency ≤ 200 ms on ESP32 @ 240 MHz, RAM ≤ 60 KB tensor arena.
5. Demonstration: cut the WiFi mid-demo; the device keeps detecting anomalies and buffers them; restore WiFi; backend catches up the buffer.

**Owner:** IIA teammate + `edge-ai-optimizer` agent.

**Bonus +15 — multi-sensor model:** one model predicts flow + temp from history. Common-trunk MLP; ~ 50 KB after INT8.

---

## 6. Pitch (60 pts) — Day 3 09:00, top teams only

### 8-minute story arc

1. **(FR, 30 s)** Le contexte : les usines tunisiennes consolident leurs données énergétiques à la main. Pour TERIAK / KILANI, c'est 5 millions de dinars d'investissement BERD en attente d'une couche d'intelligence.
2. **(EN, 60 s)** End-to-end demo: an ESP32 reads flow / heat / radio → server → live dashboard.
3. **(EN, 90 s)** Document extraction: drag a STEG bill onto the dashboard → 4 seconds → 12 fields, normalized to kWh, CO₂ computed, factor cited.
4. **(EN, 60 s)** Forecasting + anomaly: live IoT spike → detected, classified, alerted. Cut the WiFi → device keeps detecting (Track A demo).
5. **(EN, 90 s)** **Track B**: top-3 heat recovery scenarios on the audited site — quantified. "Economiser on Chaudière 1 → 600 MWh/yr → 120 t CO₂/yr → 9-month payback."
6. **(FR, 30 s)** Vision: this is the data spine of an industrial-energy operating system. Phase 2 = multi-site rollout. Phase 3 = exec dashboard for the group.

### What the jury rewards (35 + 25 pts)

- **Technical depth** (35 pts) — own algorithm choices + trade-offs + failure modes.
- **Scalability + industrial relevance** (25 pts) — does this work at real scale? Does it solve the sponsor's actual pain?

### Numbers to memorize for the deck

- Uptime % over Part 1 5-min windows.
- F1 of extraction on practice + test set.
- CO₂ baseline tCO₂/yr.
- Track B top scenario: kWh/yr saved + tCO₂/yr + DT savings + payback months.
- Model size (KB) + latency (ms) on ESP32.

### What makes our pitch different

1. We start with the audit and end with a sankey of saved energy. Most teams will start with code and end with a chart.
2. We name STEG, ADEME, IPCC, IEA factors with versions — auditable.
3. We show a real industrial document (one of Talel's uploaded bills) extracting in 4 seconds on stage.
4. The disconnect-the-WiFi moment is visceral if Track A works.

---

## 7. Repository layout (post-spec-alignment)

```
.
├── .claude/                # 8 agents, 17 skills, 11 slash commands
│   ├── agents/             # frontend-designer, backend-engineer, ai-engineer, ml-engineer,
│   │                       # data-engineer, edge-ai-optimizer,
│   │                       # document-intelligence-engineer, energy-domain-engineer
│   ├── skills/             # nestjs-module, nextjs-component, langgraph-workflow,
│   │                       # ml-pipeline, mcp-server, iot-mqtt-pipeline, energy-dashboard,
│   │                       # edge-quantization, tflite-micro-esp32, yolo-deployment,
│   │                       # large-data-pipeline, model-distillation,
│   │                       # document-extraction, energy-units-co2,
│   │                       # anomaly-detection-timeseries, heat-recovery-prioritization,
│   │                       # submission-platform-client
│   ├── commands/           # install-all, new-feature, lock-project, quantize-model,
│   │                       # profile-edge, post-leak-pivot,
│   │                       # extract-bills, normalize-units, co2-baseline, heat-recovery-scan
│   └── settings.json
├── apps/
│   ├── backend/            # NestJS — Part 1 server + Part 2 unified data layer
│   ├── frontend/           # Next.js — Part 2 dashboard
│   ├── ai-agents/          # LangGraph orchestrator (extract → norm → CO₂ → forecast → anomaly)
│   ├── ml-pipeline/        # Forecaster + anomaly + Part 3A predictor
│   ├── doc-extraction/     # Part 2 §2.1 — OCR + LLM extraction + submission
│   ├── heat-recovery/      # Part 3 Track B — inventory + MCDA + ROI
│   ├── edge-runtime/       # Part 3 Track A — TFLite-Micro export + ESP32 benchmarks
│   └── firmware/
│       └── esp32/          # PlatformIO sketch for the sensor stand
├── packages/               # shared TS types + utils + api-client
├── data/                   # GITIGNORED. raw/audit, raw/factures, raw/tri-gen, processed, calib, splits
├── models/                 # GITIGNORED. checkpoints + pre-quant exports
├── notebooks/              # exploration only
├── infra/
│   ├── docker/             # Mosquitto + Postgres+TimescaleDB + Redis + MLflow
│   └── edge-targets/       # esp32-s3.yaml (only target now)
├── docs/
│   ├── brainstorm/         # this file
│   ├── architecture/       # ADR-002 (post-leak), ADR-003 (spec-alignment)
│   ├── pitch/              # deck + rehearsal notes + handout
│   └── research/           # IPCC / ADEME / IEA / audit references
└── scripts/
```

---

## 8. Hardware bill of materials (current)

| Item | Qty | Status |
|---|---:|---|
| ESP32 DevKit (any: original / S3 / WROOM-32) | 1–2 | **on hand** |
| Flow sensor (water or gas, hall-effect / pulse) | 1 | **on hand** |
| Heat / temperature sensor (DS18B20 or thermocouple + MAX6675) | 1 | **on hand** |
| Microwave / radiowave sensor (RCWL-0516 or similar) | 1 | **on hand** |
| Breadboard + jumpers + 5 V supply | 1 | **on hand** |
| Laptop running Mosquitto + Postgres + the dashboard | 1 | Talel / roommate |
| (Optional) BME280 (T/RH/P over I²C) | 1 | Stretch |
| (Optional) SCT-013-030 current clamp + INA219 | 1 | Stretch |

**No Pi, no ESP32-CAM** (per the user's confirmation). All edge inference is ESP32-only.

---

## 9. 24-hour playbook (May 2 14:00 → May 3 14:00 — overlap with parts)

| Hours | Track | Owner | Deliverable |
|---:|---|---|---|
| Day 1 14:00 → 23:00 | **Pre-hack** (right now) | All | Repo aligned with spec ✓; data staged ✓; sensors validated; team brief done. Chem/bio reads audit; Talel writes extraction baseline against `data/raw/factures/`. |
| Day 1 23:00 → Day 2 14:00 | **Part 1** (15 h) | IIA + roommate | ESP32 reading 3 sensors, MQTT to Mosquitto, server logs valid data, reconnection works, dashboard shows live chart. |
| Day 2 00:00 → Day 2 06:00 | **Part 2 + Part 3 announce, sleep shifts** | Talel + chem/bio | Test set downloaded; pipeline pointed at it; first F1 from platform. Chem/bio start Track B inventory. |
| Day 2 06:00 → Day 2 14:00 | Part 2 extraction tuning | Talel + roommate | Schema-pass rate ≥ 90%, F1 ≥ 0.8 on extraction. |
| Day 2 14:00 → Day 2 20:00 | Part 2 CO₂ + forecast + anomaly | Talel + ml | All three flows producing numbers; dashboard wired. |
| Day 2 20:00 → Day 3 00:00 | Part 2 polish + Track B writing | Roommate + chem/bio | Dashboard shippable; Track B top-3 scenarios drafted. |
| Day 3 00:00 → Day 3 04:00 | Track A port (stretch) | IIA + Talel | Forecaster → TFLite INT8 → ESP32; latency check. |
| Day 3 04:00 → Day 3 05:00 | All submissions | All | Push GitHub; submit Part 3 deliverables. |
| Day 3 05:00 → Day 3 07:00 | Pitch deck + record perfect-run video | Talel + chem/bio #2 | 8-min deck rehearsed twice; video saved. |
| Day 3 07:00 → Day 3 09:00 | Sleep / breakfast / final rehearsal | All | Pitch fresh > pitch with 5 more features. |
| Day 3 09:00 | **Pitch** | Whole team | First place. |

---

## 10. Pre-hackathon homework (right now, before Part 1 announces at Day 1 23:00)

### Talel
- [ ] Run a paddleocr + Claude Sonnet baseline on three randomly chosen JPEGs from `data/raw/factures/`. Note: schema, common fields, bill structure, OCR quality on this data.
- [ ] Read a STEG bill end-to-end manually; note any gotchas (peak/off-peak slots, redevance de puissance, kVARh penalty).
- [ ] Verify LangGraph + Anthropic API key works.
- [ ] Memorize the FR/EN pitch arc.

### Roommate
- [ ] Bring up `docker compose -f infra/docker/docker-compose.yml up -d`. Confirm Mosquitto + Postgres + TimescaleDB are reachable.
- [ ] NestJS skeleton: one `/health` endpoint working; one MQTT subscriber printing topic+payload.
- [ ] Next.js skeleton: one page with a stub Recharts line chart.

### IIA teammate
- [ ] ESP32 + flow + heat + microwave sensors on a breadboard. Each reading printed to serial at 1 Hz.
- [ ] Mosquitto reachable from the ESP32 over the laptop's WiFi hotspot.
- [ ] Test reconnection: kill MQTT, ESP32 buffers, restore, replay.

### Chem/Bio #1 (cleanroom science → energy science)
- [ ] Read `data/raw/audit/rapport_audit.pdf` cover to cover (it's in French — your domain). Highlight every "Énergies Perdues" / "non récupérées" mention in I-3 and I-4.
- [ ] Build a first-pass inventory: 8-12 candidate heat sources, with rough T-level + flow estimates.

### Chem/Bio #2 (KILANI domain + lead pitcher)
- [ ] Look up STEG industrial tariffs (HTA régime uniforme + four-tranche). Note the DT/kWh range we'll cite in ROI.
- [ ] Verify the ADEME 2024 + STEG 2023 emission factors we have in `apps/doc-extraction/src/validation/emissions.py` (when it lands).
- [ ] Memorize the 30-second French opening.

### Whole team
- [ ] One 30-minute stand-up at 18:00 today: walk through this strategy doc together, lock roles, confirm hardware, set up the team WhatsApp / Slack.

---

## 11. Risks + fallbacks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| MQTT broker unreachable from ESP32 (campus WiFi) | Med | High | Phone hotspot on the laptop; HTTP POST fallback ready. |
| Submission platform endpoint unreliable | Med | Med | Compute F1 locally on any provided ground truth; iterate offline. |
| OCR fails on the official scanned PDFs (different camera quality) | Med | High | Pre-test PaddleOCR + Tesseract + docling on `data/raw/factures/` tonight; pick the winner. |
| Track A model can't fit in 200 KB / 200 ms on ESP32 | Med | Low | Track B already gets us 75 pts; A is stretch. Plan to drop. |
| Demo hardware fails on stage | Low | High | Pre-record a "perfect run" at H+38; jump to the video within 10 s. |
| LLM API rate-limited mid-Part-2 | Low | High | Cache aggressively by SHA; batch in groups of ≤ 50 calls; fall back to a smaller model (Haiku) for low-stakes extractions. |
| Team exhaustion at pitch time | High | High | Sleep 22:00 → 02:00 in pairs; one designated pitcher rests Day 3 01:00–05:00. |
| Chem/Bio Track B numbers challenged in Q&A | Med | Med | Cite the audit PDF page number for every figure; bracket all ROI numbers (best / base / conservative). |

---

## 12. Non-negotiables (must be true at H+22, or we have not done our job)

1. ESP32 streaming 3 sensor types live to MQTT, dashboard chart updates every 1–2 s.
2. Reconnection demo works (cut WiFi, ESP32 buffers, restore, no data loss).
3. Document extraction pipeline runs end-to-end on at least the JPEG bills + Excel reports + one PDF, producing normalized kWh + CO₂ + F1 from the platform.
4. Dashboard shows: live IoT chart, KPI strip (total kWh, tCO₂, uptime %, anomalies), sankey, anomaly feed.
5. Track B top-3 scenarios in `apps/heat-recovery/scenarios/top3.xlsx` with bracketed ROI numbers.
6. Pitch rehearsed twice; perfect-run video saved.
7. Whole stack starts with one `docker compose up`.
8. Team that slept.

Anything else is bonus.

---

## 13. The compass question

When a teammate asks "should I add this feature?", the answer is yes iff:

> *Does this change a number on the rubric (F1, mAP, kWh-saved, MAE, latency, RAM, payback months, CO₂ factor) or a story in the pitch (the WiFi-cut moment, the one-bill-extracted-live moment, the audit-quoted heat source)?*

If neither, defer until H+20 polish window.

---

## Appendix A — Owner agents quick reference

| Need | Agent |
|---|---|
| Frontend / dashboard | `frontend-designer` |
| Backend (NestJS / MQTT / TimescaleDB) | `backend-engineer` |
| LangGraph orchestration / cloud LLM tools / MCP | `ai-engineer` |
| ML training / forecasting / anomaly | `ml-engineer` |
| Big-data / Parquet / DuckDB / splits / DVC | `data-engineer` |
| Quantize → ESP32 / on-device benchmark | `edge-ai-optimizer` |
| **OCR / table / Excel / submission API** | `document-intelligence-engineer` |
| **Units / CO₂ / Track B** | `energy-domain-engineer` |

## Appendix B — Slash commands quick reference

| Command | What |
|---|---|
| `/install-all` | Full monorepo install |
| `/new-feature <name>` | Vertical-slice scaffold |
| `/lock-project <name>` | ADR + CLAUDE.md update |
| `/extract-bills <dir>` | Run full extraction pipeline against a dir |
| `/normalize-units <json>` | Canonicalize energy units → kWh |
| `/co2-baseline <input>` | Compute CO₂ + reconcile balance |
| `/heat-recovery-scan` | Track B inventory + MCDA + top-3 |
| `/quantize-model <ckpt>` | One full compression cycle to TFLite-Micro |
| `/profile-edge <artifact>` | On-device latency / RAM / flash benchmark |
| `/post-leak-pivot` | Historical orientation (now superseded by ADR-003) |

## Appendix C — Sources cited in scoring

- ADEME Base Carbone v23 (2024) — emission factors
- IPCC AR6 Annex II (2021) — global-warming potentials
- IEA 2024 World Energy Outlook — grid factors
- STEG Sustainability Report 2023 — Tunisian grid factor
- ISO 50001 + ISO 14064 — energy management + GHG accounting
- The audit PDF in `data/raw/audit/rapport_audit.pdf`

---

*This document supersedes the previous AURA-cleanroom strategy. The pivot is recorded in `docs/architecture/ADR-003-spec-alignment.md`. Any conflict between this file and code → update this file first.*
