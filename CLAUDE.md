# NRTF — Project Context for Claude Code

> **Hackathon:** NRTF 3.0 (Hack-E), May 1–3, 2026, Hotel Rivera, Sousse
> **Organizers:** IEEE PES × PELS Joint Student Chapter @ INSAT Tunis
> **Main sponsor (and spec-book author):** **Groupe KILANI** — Tunisian conglomerate (pharma TERIAK/ADWYA, agri-food IKEL/Grain d'Or, dermocosmetics PROTIS, distribution, public works)
> **Theme:** Energy optimization, scoped to a real KILANI industrial problem
> **Team:** 5 — Talel + roommate (software/AI), 1 IIA student (industrial automation/embedded), 2 chemical/biological engineering students
> **Goal:** First place. Story-driven pitch + live electronics demo + tangible TND ROI for KILANI.

## Project: AURA (locked direction — multimodal edge AI, post-leak 2026-04-30)

**AURA — Adaptive HVAC Optimization for KILANI Cleanrooms, multimodal edge AI edition.** A retrofitted AI control layer for TERIAK/ADWYA pharmaceutical cleanrooms that fuses **on-edge computer vision** (PPE / occupancy / contamination plumes from an ESP32-CAM or Pi camera), **on-edge particle forecasting** (Chronos-Bolt-tiny on PMS5003 history), and an **on-edge LLM** (Phi-3-mini Q4_K_M via llama.cpp on Raspberry Pi 5) for French-language reasoning traces — all clamped by a rule-based ISO 14644 Compliance Guardian and orchestrated by a cloud LangGraph supervisor. Live demo: a tabletop mini-cleanroom (acrylic box + ESP32-S3 + ESP32-CAM + PMS5003 + 12V fan + smoke source + Pi 5) with a Next.js dashboard showing live particle counts, camera tile, compliance status, agent trace (with the runtime each step ran on), and cumulative kWh saved.

**Pitch hook:** "KILANI invested 5 M TND with EBRD/Attijari in 2022 to install an automated energy management system at TERIAK Jebel Ouest. AURA is the AI layer that sees what their sensors miss — and runs on a 4 € chip."

**Platform vision** (last pitch slide): AURA is module 1 of **KILANI EnerOS** — Phase 2 IKEL drying, Phase 3 PROTIS mixing, Phase 4 southern-TN public works solar, Phase 5 group-wide executive dashboard. Each module reuses the same edge-AI runtime, the same compression toolchain (`apps/edge-runtime/`), and the same multi-agent supervisor.

**Post-leak pivot.** On 2026-04-30 we received credible leaks that the official spec emphasizes (a) AI on edge, (b) computer vision on real video, (c) large real datasets. The architecture above absorbs all three. Formal record: `docs/architecture/ADR-002-post-leak-pivot.md`. Quick summary: run `/post-leak-pivot`.

## Where the strategy lives

- **`docs/brainstorm/STRATEGY.md`** — single source of truth. KILANI industrial portfolio, AURA project spec, pitch story arc, 24-hour playbook, BoM, risks, pre-hackathon prep checklist. Read this first.
- `docs/architecture/` — ADRs (write ADR-001 once team confirms scope on April 26).
- `docs/pitch/` — slide deck and rehearsal notes.
- `docs/research/` — reference papers (ISO 14644, cleanroom AI, EBRD/TERIAK background).

## Repository layout (NestJS-style monorepo, pnpm workspaces)

```
.
├── .claude/                # Claude Code agents, skills, settings, slash commands
│   ├── agents/             # frontend-designer, backend-engineer, ai-engineer, ml-engineer,
│   │                       # edge-ai-optimizer, computer-vision-engineer, data-engineer
│   ├── skills/             # nestjs-module, nextjs-component, langgraph-workflow,
│   │                       # ml-pipeline, mcp-server, iot-mqtt-pipeline, energy-dashboard,
│   │                       # edge-quantization, tflite-micro-esp32, cv-video-pipeline,
│   │                       # yolo-deployment, large-data-pipeline, model-distillation,
│   │                       # llm-edge-deployment, video-data-curation
│   ├── commands/           # install-all, new-feature, lock-project,
│   │                       # quantize-model, profile-edge, cv-experiment, post-leak-pivot
│   └── settings.json
├── apps/
│   ├── backend/            # NestJS 10 + Fastify + Prisma + TimescaleDB + MQTT
│   ├── frontend/           # Next.js 14 App Router + Tailwind + shadcn/ui + Recharts
│   ├── ai-agents/          # Python + LangGraph + LangChain + MCP servers + FastAPI
│   ├── ml-pipeline/        # Python + PyTorch + Chronos/TimesFM + MLflow + FastAPI (training)
│   ├── cv-pipeline/        # Python + OpenCV + Ultralytics + ByteTrack + FastAPI (CV serving)
│   ├── edge-runtime/       # Quantization, distillation, pruning, ONNX/TFLite/GGUF, on-device benchmarks
│   └── firmware/           # ESP32 + ESP32-CAM (PlatformIO) + Arduino sketches
├── packages/
│   ├── types/              # shared TypeScript types
│   ├── utils/              # shared TS utilities
│   ├── api-client/         # auto-generated from backend OpenAPI
│   └── contracts/          # Solidity (only if a fintech sub-track surfaces)
├── data/                   # GITIGNORED. raw/, processed/, calib/, splits/, eval/, video/. DVC-tracked.
├── models/                 # GITIGNORED. checkpoints/ + pre-quantization exports/. DVC-tracked.
├── notebooks/              # Jupyter exploration only — not production code
├── infra/
│   ├── docker/             # Mosquitto + Postgres+TimescaleDB + Redis + MLflow + Ollama
│   ├── edge-targets/       # YAML hardware budgets per device (esp32-s3, pi-5, coral, jetson, ...)
│   ├── scripts/
│   └── deployment/
├── docs/                   # brainstorm/STRATEGY.md, architecture/ADRs, pitch, research
└── scripts/                # cross-cutting scripts
```

## Tech stack (locked)

| Layer | Choice | Why |
|-------|--------|-----|
| Backend | NestJS 10 + Fastify | Modular, DI, TypeScript-first, IoT throughput |
| ORM | Prisma | Hackathon-speed; Postgres + TimescaleDB |
| Time-series DB | TimescaleDB | Hypertables for sensor data |
| Cache/Queue | Redis + BullMQ | Optional; skip if not needed |
| MQTT broker | Eclipse Mosquitto | ESP32 ↔ backend canonical channel |
| Frontend | Next.js 14 App Router | Server components + great DX |
| UI | shadcn/ui + Tailwind | Composable, no runtime CSS-in-JS |
| Charts | Recharts (default), Plotly (advanced) | Energy data viz |
| State | Zustand + TanStack Query | Minimal, type-safe |
| AI orchestration | LangGraph + LangChain | Multi-agent for AURA's Forecaster + Guardian + Dispatcher |
| MCP | `mcp` Python SDK | Cleanroom-as-tools moat |
| LLMs (cloud supervisor) | Claude Sonnet 4 | Quality reasoning for routing/dispatch |
| LLMs (edge reasoner) | Phi-3-mini Q4_K_M GGUF via llama.cpp on Pi 5 | Local sovereignty + French trace |
| LLMs (offline fallback) | Gemma-2-2B-it Q4_K_M, Ollama | Hardware sovereignty story |
| ML | PyTorch + Chronos-Bolt + LightGBM + Lightning | Foundation-first |
| CV | Ultralytics (YOLOv8/v10), ByteTrack, SAM-2, Grounding-DINO | Detection + tracking + label bootstrapping |
| Edge runtimes | TFLite-Micro + ESP-NN (ESP32-S3), ONNX-Runtime (Pi 5), llama.cpp (Pi 5), TensorRT (Jetson if available) | Per-target compiled paths |
| Compression | torch.ao.quantization, ai_edge_torch, llama.cpp quantize, torchdistill | Distill → prune → quantize → compile |
| Big data | Polars (lazy + streaming), DuckDB, Parquet (zstd, partitioned), webdataset | Laptop-scale handling of leaked dataset |
| Data versioning | DVC + `_manifest.json` SHAs | Lineage in MLflow runs |
| Firmware | PlatformIO + Arduino-ESP32 + ESP-IDF + ESP-NN | Standard ESP32-S3 + ESP32-CAM toolchain |

## Running the agents

Custom agents live in `.claude/agents/`. Invoke with the Task tool by `subagent_type`:

| Agent | When to use on AURA |
|-------|---------------------|
| `frontend-designer` | AURA dashboard (particle chart, camera tile, compliance LED, agent trace with runtime tags, 4-bar accuracy chart, kWh counter) |
| `backend-engineer` | NestJS modules: devices, readings, compliance; MQTT ingest; ai-bridge; Redis Streams for camera frames |
| `ai-engineer` | LangGraph graph: Supervisor (cloud) + Vision agent (CV pipeline) + Forecaster + Reasoner (Pi 5 LLM) + Compliance Guardian + Dispatcher; cleanroom MCP server; CV-tools wrappers |
| `ml-engineer` | Foundation-fine-tune-then-distill on leaked KILANI data: Chronos-Bolt for particles, YOLOv8 for vision; teacher checkpoints + ONNX exports for handoff to `edge-ai-optimizer` |
| `edge-ai-optimizer` | **NEW.** Quantization (INT8 / GGUF), distillation, pruning, on-device benchmarking. Target devices: ESP32-S3, ESP32-CAM, Pi 5, Coral, Jetson. Owns `apps/edge-runtime/`. |
| `computer-vision-engineer` | **NEW.** Video ingestion, YOLO training, ByteTrack, PPE / occupancy / plume detectors, label bootstrapping with SAM-2 + Grounding-DINO. Owns `apps/cv-pipeline/`. |
| `data-engineer` | **NEW.** Leaked-dataset ingestion (Parquet + webdataset shards), DuckDB / Polars queries, frozen splits without leakage, calibration sets, DVC versioning. Owns `data/`. |

## Skills

Auto-loaded from `.claude/skills/`:

**Original stack**
- `nestjs-module` — feature-module scaffold for backend
- `nextjs-component` — App Router component scaffold
- `langgraph-workflow` — multi-agent graph patterns (use for AURA's multi-agent controller)
- `ml-pipeline` — training/inference pattern
- `mcp-server` — wrap the cleanroom (or its simulator) as MCP tools
- `iot-mqtt-pipeline` — ESP32 → Mosquitto → Timescale conventions
- `energy-dashboard` — chart selection, units, color semantics, demo-mode pattern

**Post-leak additions**
- `edge-quantization` — INT8 / INT4 / FP16 PTQ + QAT recipes, calibration set design, accuracy reporting
- `tflite-micro-esp32` — TFLite-Micro on ESP32-S3 with ESP-NN, op resolver, tensor arena sizing, model.h handoff
- `cv-video-pipeline` — OpenCV / PyAV / decord ingest, RTSP bounded queues, ROI cropping, frame sampling
- `yolo-deployment` — Ultralytics training + ONNX/TFLite/TensorRT export + on-device benchmarks
- `large-data-pipeline` — Polars lazy/streaming, DuckDB on Parquet, webdataset shards, TimescaleDB rollups
- `model-distillation` — teacher → student KD recipes (response, feature/hint, transformer)
- `llm-edge-deployment` — GGUF + llama.cpp + small models for Pi 5 (Phi-3-mini default)
- `video-data-curation` — bootstrap labels with SAM-2 + Grounding-DINO, DVC video shards, leak-free splits

## Slash commands (`.claude/commands/`)

- `/install-all` — full monorepo install (pnpm + python venvs + docker + platformio + llama.cpp + DVC)
- `/new-feature <name>` — scaffold a vertical slice (backend module + frontend page + types)
- `/lock-project <name>` — write ADR-001 + update CLAUDE.md once scope is confirmed
- `/quantize-model <ckpt> <target>` — drive `edge-ai-optimizer` through one full compression cycle (calibrate → quantize → audit ops → on-device benchmark → report)
- `/profile-edge <artifact> <target>` — benchmark an artifact on actual edge hardware (latency P50/P95, RAM, flash, energy)
- `/cv-experiment <task> <dataset>` — scaffold a CV task (task card, dataset YAML, frozen splits, baseline YOLOv8n run)
- `/post-leak-pivot` — print the post-leak orientation summary (what changed, what owns it, what to read)

## Coding conventions (repo-wide)

- TypeScript strict mode. No `any` without explicit reason.
- Python: `ruff` for lint+format, `mypy` where feasible.
- Conventional commits: `feat(backend):`, `fix(frontend):`, `chore(docs):`, etc.
- Co-located tests per module.
- Secrets via `.env` (never committed); `.env.example` documents shape.
- AURA-specific: every AI decision must produce a French-language reasoning trace; the Compliance Guardian is rule-based, not LLM-based, and its output is non-overridable.

## Hackathon-mode rules (May 1–3 only)

- Skip Storybook, full test coverage, Swagger customization.
- Streamlit is acceptable for any quick-and-dirty internal eval dashboard.
- Pre-build hardware before clock starts (verify with organizers).
- Record a "perfect run" demo video at H20.
- Sleep matters more than the last 5 features. Ship at H22, polish + sleep.

## Daily / sprint commands

```bash
# install everything (or run /install-all)
pnpm install
cd apps/ai-agents   && pip install -r requirements.txt
cd apps/ml-pipeline && pip install -r requirements.txt
cd apps/cv-pipeline && pip install -r requirements.txt   # post-leak addition
cd apps/edge-runtime && pip install -r requirements.txt  # post-leak addition

# spin up local services (Mosquitto, Postgres+Timescale, Redis, MLflow, Ollama, llama.cpp server)
docker compose -f infra/docker/docker-compose.yml up -d

# dev (one terminal each)
pnpm --filter backend  dev      # NestJS on :3000
pnpm --filter frontend dev      # Next.js on :3001
cd apps/ai-agents    && uvicorn src.api.server:app       --port 8001
cd apps/ml-pipeline  && uvicorn src.inference.server:app --port 8002
cd apps/cv-pipeline  && uvicorn src.inference.server:app --port 8003

# edge LLM (on Pi 5 — separate device)
./llama-server -m phi3-mini-q4_k_m.gguf -c 4096 --host 0.0.0.0 --port 8080 -t 4

# tests
pnpm --filter backend test
pnpm --filter frontend test
cd apps/ai-agents   && pytest
cd apps/ml-pipeline && pytest
cd apps/cv-pipeline && pytest
```

## Key team contacts

- **Talel** (lead, software/AI) — talel.boussetta@insat.ucar.tn
- Roommate (software/AI) — TBD
- IIA teammate (embedded / hardware lead for AURA mini-cleanroom) — TBD
- Chem/Bio #1 (GMP / ISO 14644 cleanroom science) — TBD
- Chem/Bio #2 (KILANI domain + lead pitcher) — TBD

## Open decisions

- [ ] Confirm AURA fits the official KILANI spec book (may pivot in H1 if spec emphasizes IKEL/PROTIS/public works instead — architecture survives via ADR-002)
- [ ] PMS5003 particle sensor procurement — order this week
- [ ] **Post-leak hardware:** ESP32-S3 (×2), ESP32-CAM (×2), Raspberry Pi 5 8 GB (×1) + Pi Camera Module 3 — order today
- [ ] **Coral USB Accelerator** — stretch buy if budget allows
- [ ] **Leaked dataset access** — confirm location, license, format before H0
- [ ] **GPU rental** — pre-book Lambda / Vast.ai for foundation-model fine-tuning during H4-H10
- [ ] Demo box source (lab borrow vs purchase)
- [ ] Pitch language split (current plan: French opening + English technical slides + Tunisian Arabic phrase in hook)
- [ ] Sleep strategy (full team 24h vs shifts of 2)
- [ ] Demo failure-mode policy — when to switch to the pre-recorded "perfect run" video
