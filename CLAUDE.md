# Re·Tech Fusion — Project Context for Claude Code

> **Hackathon:** Re·Tech Fusion (RETF) — Industrial AI & IoT, INSAT University of Carthage
> **Dates:** May 1–3, 2026 (Day 1 active right now)
> **Theme:** End-to-end industrial energy intelligence: IoT → unified data → CO₂ → anomaly → dashboard → edge resilience → waste-heat recovery
> **Team:** 5 — Talel + roommate (software/AI), 1 IIA student (industrial automation/embedded), 2 chemical/biological engineering students
> **Goal:** First place. Three parts + pitch session.

## Read this first

**`docs/brainstorm/STRATEGY.md`** is the single source of truth. It covers spec recap, scoring, architecture, BoM, 24-h playbook, pre-hack homework, risks, owner-per-deliverable, and the pitch arc. Anything in this file that conflicts with STRATEGY.md is wrong; update STRATEGY.md first, then code.

The spec-aligned pivot from the older AURA-cleanroom direction is recorded in **`docs/architecture/ADR-003-spec-alignment.md`**. The previous ADR-002 (post-leak multimodal-edge-AI direction) is superseded but kept as history.

## What we're building

Three parts + pitch:

| Part | Deadline | Points | Owner deliverable |
|---|---|---:|---|
| **Part 1 — IoT Device & Protocol** | Day 2 14:00 | 95 + 15 | ESP32 + 3 sensors → MQTT → backend |
| **Part 2 — Pipeline, Unification, Modeling** | Day 3 00:00 | 120 + 40 | Heterogeneous documents → unified table → CO₂ → forecast → anomaly → dashboard |
| **Part 3A (stretch) — Edge Inference** | Day 3 05:00 | 75 + 15 | ESP32 forecaster + on-device anomaly |
| **Part 3B (primary) — Heat Recovery** | Day 3 05:00 | 75 + 15 | Audit-driven heat-source MCDA + top-3 ROI scenarios |
| **Pitch** | Day 3 09:00 | 60 | Top teams only; 8 min + 7 min Q&A |

We commit to Track B as primary, Track A as stretch. Hardware: ESP32 only (no Raspberry Pi, no ESP32-CAM, no video).

## Practice data already staged (use it before Part 2 announces)

- `data/raw/audit/rapport_audit.pdf` — 15-page French audit of a pharma factory (tri-gen 1.2 MW + STEG + gas + 3 zones). Read it tonight; Track B inventory comes from this.
- `data/raw/factures/` — 33 JPEG bills + 5 PDF batches. Practice corpus for the document-extraction pipeline.
- `data/raw/tri-gen/` — 22 monthly Excel reports (Jul 2025 → Apr 2026). Practice corpus for Excel extraction + IoT-like time series.

Each folder has a `_manifest.json` with SHAs.

## Repository layout

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
│   ├── doc-extraction/     # Part 2 §2.1 — OCR + LLM extraction + submission API
│   ├── heat-recovery/      # Part 3 Track B — inventory + MCDA + ROI top-3
│   ├── edge-runtime/       # Part 3 Track A — quantize → TFLite-Micro for ESP32
│   └── firmware/
│       └── esp32/          # PlatformIO sketch for the sensor stand
├── packages/               # shared TS types + utils + api-client + (contracts unused)
├── data/                   # GITIGNORED. raw/{audit,factures,tri-gen}, processed, calib, splits, eval
├── models/                 # GITIGNORED. checkpoints + pre-quantization exports
├── notebooks/              # exploration only
├── infra/
│   ├── docker/             # Mosquitto + Postgres+TimescaleDB + Redis + MLflow
│   └── edge-targets/       # esp32-s3.yaml only (the single edge target now)
├── docs/
│   ├── brainstorm/STRATEGY.md       # SINGLE SOURCE OF TRUTH
│   ├── architecture/ADR-002-…       # post-leak (superseded)
│   ├── architecture/ADR-003-…       # spec-aligned (active)
│   ├── pitch/                       # deck + rehearsal notes + handout
│   └── research/                    # IPCC / ADEME / IEA / audit references
└── scripts/
```

## Tech stack (locked)

| Layer | Choice | Why |
|---|---|---|
| Backend | NestJS 10 + Fastify | Modular, DI, TypeScript-first, IoT throughput |
| ORM | Prisma | Hackathon-speed; Postgres + TimescaleDB |
| Time-series DB | TimescaleDB | Hypertables + continuous aggregates |
| MQTT broker | Eclipse Mosquitto | ESP32 ↔ backend canonical channel |
| Frontend | Next.js 14 + Tailwind + shadcn/ui + Recharts (+ Plotly for sankey) | Composable, fast |
| AI orchestration | LangGraph + LangChain | Multi-agent for Part 2 (extract → norm → CO₂ → forecast → anomaly) |
| Cloud LLM | Claude Sonnet 4 | Constrained-output extraction + supervisor reasoning |
| OCR | PaddleOCR (lang=fr primary) + Tesseract (fra+ara fallback) + docling/Marker for dense layouts | French Tunisian bills |
| Document parsing | pdfplumber + Camelot (native PDF), openpyxl + Polars (Excel), pdf2image (scanned PDF) | Heterogeneous spec |
| ML | PyTorch + Chronos-Bolt + LightGBM + scikit-learn + Lightning | Foundation-first forecasting |
| Anomaly | rolling-MAD + STL + IsolationForest server-side; ring-buffer C on ESP32 | Same algorithms, two runtimes |
| Edge runtime | TFLite-Micro + ESP-NN (ESP32-S3) | Track A target |
| Compression | torch.ao.quantization, ai_edge_torch | INT8 PTQ for the on-device forecaster |
| Big data | Polars (lazy + streaming) + DuckDB + Parquet (zstd) + Pandera | Heterogeneous practice corpus |
| Data versioning | DVC + `_manifest.json` SHAs | Lineage |
| Firmware | PlatformIO + Arduino-ESP32 + ESP-IDF (+ ESP-NN if S3) | ESP32-only |

## Agents

| Agent | Owns | When to use |
|---|---|---|
| `frontend-designer` | `apps/frontend/` | Dashboard: KPI strip, live IoT chart, sankey of energy flows, anomaly feed, Track B scenarios table |
| `backend-engineer` | `apps/backend/` | NestJS modules (devices, readings, events, extracted-records); MQTT ingest; ai-bridge |
| `ai-engineer` | `apps/ai-agents/` | LangGraph orchestrator (Supervisor → Extract → Normalize → CO₂ → Forecast → Anomaly → Track B advisor); Sonnet tool calls |
| `ml-engineer` | `apps/ml-pipeline/` | Chronos / LightGBM forecasters, anomaly detectors, Part 3A predictive model |
| `data-engineer` | `data/`, sinks | Polars/DuckDB queries on the practice + test corpus, Parquet partitioning, splits, manifests |
| `edge-ai-optimizer` | `apps/edge-runtime/` | Track A: quantize the forecaster to TFLite-Micro INT8, on-device benchmark, model.h handoff to firmware |
| **`document-intelligence-engineer`** | `apps/doc-extraction/` | Part 2 §2.1 — file typing, OCR, LLM-assisted extraction with Pydantic, submission POST |
| **`energy-domain-engineer`** | `apps/heat-recovery/`, units/CO₂ tables | Part 2 §2.2 unit normalization + CO₂; Part 3 Track B MCDA + ROI |

## Skills (auto-loaded from `.claude/skills/`)

**Stack basics:** `nestjs-module`, `nextjs-component`, `langgraph-workflow`, `ml-pipeline`, `mcp-server`, `iot-mqtt-pipeline`, `energy-dashboard`.

**Edge / Track A:** `edge-quantization`, `tflite-micro-esp32`, `model-distillation`, `large-data-pipeline`. (`yolo-deployment` kept as a hedge for layout detection on scans.)

**Part 2 / Track B (post-spec additions):** `document-extraction`, `energy-units-co2`, `anomaly-detection-timeseries`, `heat-recovery-prioritization`, `submission-platform-client`.

## Slash commands (`.claude/commands/`)

- `/install-all` — full monorepo install
- `/new-feature <name>` — vertical-slice scaffold
- `/lock-project <name>` — ADR + CLAUDE.md update
- `/quantize-model <ckpt> <target>` — Track A compression cycle
- `/profile-edge <artifact> <target>` — on-device latency / RAM / flash benchmark
- `/post-leak-pivot` — historical orientation (now superseded by ADR-003)
- `/extract-bills <dir>` — run the full extraction pipeline against a directory
- `/normalize-units <json>` — canonicalize energy units → kWh
- `/co2-baseline <input>` — compute CO₂ + reconcile balance ± 5%
- `/heat-recovery-scan` — Track B inventory + MCDA + top-3 ROI

## Coding conventions

- TypeScript strict mode, no `any` without reason.
- Python: `ruff` for lint+format, `mypy` where feasible.
- Conventional commits: `feat(backend):`, `fix(extraction):`, `chore(docs):`, etc.
- Co-located tests per module.
- Secrets via `.env` (never committed); `.env.example` documents shape.
- Every extraction record carries a `source` field (page, bbox, OCR engine, confidence) for auditability.
- Every CO₂ number cites its emission factor source.
- Every Track B scenario brackets ROI: best / base / conservative.

## Hackathon-mode rules (May 1–3 only)

- Skip Storybook, full test coverage, Swagger customization.
- Streamlit is acceptable for internal eval dashboards.
- Cache OCR + LLM results aggressively by file SHA.
- Record a "perfect run" demo video at H+38.
- Submit at H+22 of each part, polish, then sleep. Pitch quality > feature count.
- Compass question: *does this change a number on the rubric or a story in the pitch?* If neither, defer.

## Daily / sprint commands

```bash
# install everything (or /install-all)
pnpm install
cd apps/ai-agents     && pip install -r requirements.txt
cd apps/ml-pipeline   && pip install -r requirements.txt
cd apps/doc-extraction && pip install -r requirements.txt
cd apps/edge-runtime  && pip install -r requirements.txt
cd apps/heat-recovery && pip install -r requirements.txt

# spin up local services
docker compose -f infra/docker/docker-compose.yml up -d

# dev (one terminal each)
pnpm --filter backend  dev                                                # NestJS :3000
pnpm --filter frontend dev                                                # Next.js :3001
cd apps/ai-agents      && uvicorn src.api.server:app       --port 8001
cd apps/ml-pipeline    && uvicorn src.inference.server:app --port 8002
cd apps/doc-extraction && uvicorn src.inference.server:app --port 8003

# tests
pnpm --filter backend test
pnpm --filter frontend test
cd apps/ai-agents      && pytest
cd apps/ml-pipeline    && pytest
cd apps/doc-extraction && pytest
```

## Sensor stand (Part 1)

| # | Sensor | Wiring | Metric |
|---|---|---|---|
| 1 | Flow sensor (e.g. YF-S201) | digital pulse / interrupt | flow_lpm |
| 2 | Heat / temperature (DS18B20 OneWire or thermocouple + MAX6675/MAX31855) | OneWire / SPI | temp_c |
| 3 | Microwave / radiowave (e.g. RCWL-0516 doppler, or analog level) | digital / analog | presence_or_level |
| Stretch | BME280 or current clamp + INA219 | I²C | humidity / pressure / current |

No Pi, no ESP32-CAM. No video. ESP32-only edge.

## Key team contacts

- **Talel** (lead, software/AI) — talel.boussetta@insat.ucar.tn
- Roommate (software/AI) — TBD
- IIA teammate (embedded / Part 1 hardware lead) — TBD
- Chem/Bio #1 (energy domain + Track B inventory) — TBD
- Chem/Bio #2 (audit narrative + lead pitcher) — TBD

## Open decisions (close at the 18:00 stand-up today)

- [ ] Confirm sensor identities + ranges + units (flow / heat / radio).
- [ ] Confirm ESP32 variant (plain vs S3 — affects Track A op kernels).
- [ ] Confirm laptop running Mosquitto + Postgres + dashboard (Talel's or roommate's).
- [ ] Confirm sleep schedule: pairs (recommended) vs solo all-nighter.
- [ ] Confirm pitch language split (current plan: French open + English technical + FR close).
- [ ] Confirm fallback policy: when do we cut to the perfect-run video on stage?
- [ ] Confirm chem/bio teammates have read the audit + understood §I-3 / §I-4 by 18:00.
