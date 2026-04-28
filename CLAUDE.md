# NRTF — Project Context for Claude Code

> **Hackathon:** NRTF 3.0 (Hack-E), May 1–3, 2026, Hotel Rivera, Sousse
> **Organizers:** IEEE PES × PELS Joint Student Chapter @ INSAT Tunis
> **Theme:** Energy optimization (renewables + power electronics + AI)
> **Team:** 5 — Talel + roommate (software/AI), 1 IIA student (industrial automation/embedded), 2 chemical/biological engineering students
> **Goal:** First place. Prize pool 10,000+ TND.

## Where the strategy lives

- `docs/brainstorm/01_finalists_v1.md` — top 12 cross-disciplinary ideas, 3 finalists (H2-Sentinel, Thermal Runaway, Greenhouse Co-Optimizer), team-fit logic.
- `docs/brainstorm/02_ai_trends_fintech_prep_v2.md` — AI trend × energy map (20 trends), 5 wildcards (AthenaGrid is highest-scoring at 22/25), 10 fintech crossovers, BoM, datasets, sponsor map, pitch hooks. **Read this first.**
- `docs/architecture/` — ADRs once project is locked.
- `docs/pitch/` — pitch deck and talking points.

## Repository layout (NestJS-style monorepo, pnpm workspaces)

```
.
├── .claude/                # Claude Code agents, skills, settings
│   ├── agents/             # frontend-designer, backend-engineer, ai-engineer, ml-engineer
│   ├── skills/             # nestjs-module, nextjs-component, langgraph-workflow, ml-pipeline, mcp-server, iot-mqtt-pipeline, energy-dashboard
│   └── settings.json
├── apps/
│   ├── backend/            # NestJS 10 + Fastify + Prisma + TimescaleDB + MQTT
│   ├── frontend/           # Next.js 14 App Router + Tailwind + shadcn/ui + Recharts
│   ├── ai-agents/          # Python + LangGraph + LangChain + MCP servers + FastAPI
│   ├── ml-pipeline/        # Python + PyTorch + Chronos/TimesFM + MLflow + FastAPI
│   └── firmware/           # ESP32 (PlatformIO) + Arduino sketches
├── packages/
│   ├── types/              # shared TypeScript types (frontend ⇄ backend)
│   ├── utils/              # shared TS utilities
│   ├── api-client/         # auto-generated from backend OpenAPI
│   └── contracts/          # Solidity smart contracts (if fintech path)
├── infra/
│   ├── docker/             # docker-compose.yml + Mosquitto + Postgres+Timescale + Redis
│   ├── scripts/            # setup, seed, deploy
│   └── deployment/
├── docs/                   # brainstorm, architecture, pitch, research
└── scripts/                # cross-cutting scripts
```

## Tech stack (locked)

| Layer | Choice | Why |
|-------|--------|-----|
| Backend | NestJS 10 + Fastify | Modular, DI, TypeScript-first, IoT throughput |
| ORM | Prisma | Hackathon-speed; Postgres + TimescaleDB |
| Time-series DB | TimescaleDB | Hypertables for sensor data |
| Cache/Queue | Redis + BullMQ | Background jobs (skip if not needed) |
| MQTT broker | Eclipse Mosquitto | Industry standard for IoT |
| Frontend | Next.js 14 App Router | Server components + great DX |
| UI primitives | shadcn/ui + Tailwind | Composable, no runtime CSS-in-JS |
| Charts | Recharts (default), Plotly (advanced) | Energy data viz |
| State | Zustand + TanStack Query | Minimal, type-safe |
| AI orchestration | LangGraph + LangChain | Multi-agent, MCP-compatible |
| MCP | `mcp` Python SDK | Hardware-as-tools moat |
| LLMs | Claude Sonnet 4 (default), Ollama Gemma 4 (local) | Quality + sovereignty |
| ML | PyTorch + Chronos-Bolt + LightGBM + Lightning | Foundation-first |
| Firmware | PlatformIO + Arduino-ESP32 | Standard ESP32 toolchain |
| Smart contracts (if needed) | Hardhat + Solidity 0.8 | Polygon Amoy testnet |

## Running the agents

Custom agents live in `.claude/agents/`. Invoke with the Task tool by `subagent_type`:

| Agent | When to use |
|-------|-------------|
| `frontend-designer` | Any Next.js / React / Tailwind / chart / dashboard work |
| `backend-engineer` | NestJS modules, REST/WS endpoints, MQTT, DB, integrations |
| `ai-engineer` | LangGraph workflows, MCP servers, RAG, prompts, agents |
| `ml-engineer` | Data, training, evaluation, foundation models, PINNs, TinyML |

## Skills

Reusable patterns live in `.claude/skills/`. Skills auto-load when relevant. Manually invoke if needed.

## Coding conventions (repo-wide)

- **TypeScript strict mode.** No `any` without explicit reason.
- **Python: `ruff` for lint + format, `mypy --strict` where feasible.**
- **Conventional commits.** `feat(backend):`, `fix(frontend):`, `chore(docs):`, etc.
- **One PR per feature module.** Squash on merge.
- **Co-located tests.** Each module has its own `tests/`.
- **No dead code.** Delete instead of comment.
- **Secrets via `.env`** (never committed). `.env.example` documents shape.

## Hackathon-mode rules (apply during May 1–3 only)

- Skip Storybook, full test coverage, Swagger customization, Storybook MDX.
- Prefer Streamlit for quick eval dashboards.
- Pre-build hardware before clock starts (verify with organizers).
- Record a "perfect run" demo video the night before pitch.
- Sleep matters more than the last 5 features. Ship at hour 22, polish + sleep.

## Daily / sprint commands

```bash
# install everything
pnpm install                                # JS workspaces
cd apps/ai-agents && pip install -r requirements.txt
cd apps/ml-pipeline && pip install -r requirements.txt

# spin up local services
docker compose -f infra/docker/docker-compose.yml up -d

# dev
pnpm --filter backend dev
pnpm --filter frontend dev
pnpm --filter ai-agents dev    # or python -m src.api.server
pnpm --filter ml-pipeline dev  # or python -m src.inference.server

# tests
pnpm --filter backend test
pnpm --filter frontend test
cd apps/ai-agents && pytest
cd apps/ml-pipeline && pytest
```

## Key team contacts

- **Talel** (lead, software/AI) — talel.boussetta@insat.ucar.tn
- Roommate (software/AI) — TBD
- IIA teammate (embedded) — TBD
- Chem/Bio teammate #1 — TBD
- Chem/Bio teammate #2 — TBD

## Open decisions

- [ ] Which finalist project to commit to (top-7 in v2 doc; AthenaGrid leads on score)
- [ ] Hardware procurement complete by April 30 (PEM cell critical-path)
- [ ] Pitcher assignment (FR/EN bilingual, 5 min under pressure)
- [ ] Sleep strategy (full team 24h vs shifts)
