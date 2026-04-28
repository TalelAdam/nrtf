# NRTF — Project Context for Claude Code

> **Hackathon:** NRTF 3.0 (Hack-E), May 1–3, 2026, Hotel Rivera, Sousse
> **Organizers:** IEEE PES × PELS Joint Student Chapter @ INSAT Tunis
> **Main sponsor (and spec-book author):** **Groupe KILANI** — Tunisian conglomerate (pharma TERIAK/ADWYA, agri-food IKEL/Grain d'Or, dermocosmetics PROTIS, distribution, public works)
> **Theme:** Energy optimization, scoped to a real KILANI industrial problem
> **Team:** 5 — Talel + roommate (software/AI), 1 IIA student (industrial automation/embedded), 2 chemical/biological engineering students
> **Goal:** First place. Story-driven pitch + live electronics demo + tangible TND ROI for KILANI.

## Project: AURA (locked direction)

**AURA — Adaptive HVAC Optimization for KILANI Cleanrooms.** A retrofitted AI control layer for TERIAK/ADWYA pharmaceutical cleanrooms that modulates air-change rates based on real-time particle counts and occupancy, while guaranteeing ISO 14644 compliance via a hard-clamped Compliance Guardian. Live demo: a tabletop mini-cleanroom (acrylic box + ESP32 + PMS5003 particle sensor + 12V fan + smoke source) controlled by a LangGraph multi-agent system, with a Next.js dashboard showing live particle counts, fan power, compliance status, and cumulative kWh saved.

**Pitch hook:** "KILANI invested 5 M TND with EBRD/Attijari in 2022 to install an automated energy management system at TERIAK Jebel Ouest. AURA is the AI layer that makes that investment 30% more profitable."

**Platform vision** (last pitch slide): AURA is module 1 of **KILANI EnerOS** — Phase 2 IKEL drying, Phase 3 PROTIS mixing, Phase 4 southern-TN public works solar, Phase 5 group-wide executive dashboard.

## Where the strategy lives

- **`docs/brainstorm/STRATEGY.md`** — single source of truth. KILANI industrial portfolio, AURA project spec, pitch story arc, 24-hour playbook, BoM, risks, pre-hackathon prep checklist. Read this first.
- `docs/architecture/` — ADRs (write ADR-001 once team confirms scope on April 26).
- `docs/pitch/` — slide deck and rehearsal notes.
- `docs/research/` — reference papers (ISO 14644, cleanroom AI, EBRD/TERIAK background).

## Repository layout (NestJS-style monorepo, pnpm workspaces)

```
.
├── .claude/                # Claude Code agents, skills, settings, slash commands
│   ├── agents/             # frontend-designer, backend-engineer, ai-engineer, ml-engineer
│   ├── skills/             # nestjs-module, nextjs-component, langgraph-workflow, ml-pipeline, mcp-server, iot-mqtt-pipeline, energy-dashboard
│   ├── commands/           # install-all, new-feature, lock-project
│   └── settings.json
├── apps/
│   ├── backend/            # NestJS 10 + Fastify + Prisma + TimescaleDB + MQTT
│   ├── frontend/           # Next.js 14 App Router + Tailwind + shadcn/ui + Recharts
│   ├── ai-agents/          # Python + LangGraph + LangChain + MCP servers + FastAPI
│   ├── ml-pipeline/        # Python + PyTorch + Chronos/TimesFM + MLflow + FastAPI
│   └── firmware/           # ESP32 (PlatformIO) + Arduino sketches
├── packages/
│   ├── types/              # shared TypeScript types
│   ├── utils/              # shared TS utilities
│   ├── api-client/         # auto-generated from backend OpenAPI
│   └── contracts/          # Solidity (only if a fintech sub-track surfaces)
├── infra/
│   ├── docker/             # Mosquitto + Postgres+TimescaleDB + Redis + MLflow + Ollama
│   ├── scripts/
│   └── deployment/
├── docs/                   # brainstorm/STRATEGY.md, architecture, pitch, research
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
| LLMs | Claude Sonnet 4 (default), Ollama Gemma (offline fallback) | Quality + sovereignty |
| ML | PyTorch + Chronos-Bolt + LightGBM + Lightning | Foundation-first |
| Firmware | PlatformIO + Arduino-ESP32 | Standard ESP32 toolchain |

## Running the agents

Custom agents live in `.claude/agents/`. Invoke with the Task tool by `subagent_type`:

| Agent | When to use on AURA |
|-------|---------------------|
| `frontend-designer` | AURA dashboard (particle chart, compliance LED, agent trace, kWh counter) |
| `backend-engineer` | NestJS modules: devices, readings, compliance; MQTT ingest; ai-bridge |
| `ai-engineer` | LangGraph graph for Forecaster + Compliance Guardian + Dispatcher; cleanroom MCP server |
| `ml-engineer` | Chronos-Bolt particle-count forecasting; PINN for HVAC thermodynamics if time |

## Skills

Auto-loaded from `.claude/skills/`:

- `nestjs-module` — feature-module scaffold for backend
- `nextjs-component` — App Router component scaffold
- `langgraph-workflow` — multi-agent graph patterns (use for AURA's 3-agent controller)
- `ml-pipeline` — training/inference pattern
- `mcp-server` — wrap the cleanroom (or its simulator) as MCP tools
- `iot-mqtt-pipeline` — ESP32 → Mosquitto → Timescale conventions
- `energy-dashboard` — chart selection, units, color semantics, demo-mode pattern

## Slash commands (`.claude/commands/`)

- `/install-all` — full monorepo install (pnpm + python venvs + docker + platformio)
- `/new-feature <name>` — scaffold a vertical slice (backend module + frontend page + types)
- `/lock-project <name>` — write ADR-001 + update CLAUDE.md once scope is confirmed

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
# install everything
pnpm install
cd apps/ai-agents && pip install -r requirements.txt
cd apps/ml-pipeline && pip install -r requirements.txt

# spin up local services (Mosquitto, Postgres+Timescale, Redis, MLflow, Ollama)
docker compose -f infra/docker/docker-compose.yml up -d

# dev
pnpm --filter backend  dev      # NestJS on :3000
pnpm --filter frontend dev      # Next.js on :3001
cd apps/ai-agents   && uvicorn src.api.server:app --port 8001
cd apps/ml-pipeline && uvicorn src.inference.server:app --port 8002

# tests
pnpm --filter backend test
pnpm --filter frontend test
cd apps/ai-agents   && pytest
cd apps/ml-pipeline && pytest
```

## Key team contacts

- **Talel** (lead, software/AI) — talel.boussetta@insat.ucar.tn
- Roommate (software/AI) — TBD
- IIA teammate (embedded / hardware lead for AURA mini-cleanroom) — TBD
- Chem/Bio #1 (GMP / ISO 14644 cleanroom science) — TBD
- Chem/Bio #2 (KILANI domain + lead pitcher) — TBD

## Open decisions

- [ ] Confirm AURA fits the official KILANI spec book (may pivot in H1 if spec emphasizes IKEL/PROTIS/public works instead)
- [ ] PMS5003 particle sensor procurement — order this week
- [ ] Demo box source (lab borrow vs purchase)
- [ ] Pitch language split (current plan: French opening + English technical slides + Tunisian Arabic phrase in hook)
- [ ] Sleep strategy (full team 24h vs shifts of 2)
