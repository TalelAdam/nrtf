# NRTF — Hack-E 2026

> Team competing in NRTF 3.0 (May 1–3, 2026, Sousse, Tunisia) on the energy-optimization theme.

## Quick start

```bash
# 1. Install JS workspaces
pnpm install

# 2. Install Python apps
cd apps/ai-agents   && pip install -r requirements.txt && cd ../..
cd apps/ml-pipeline && pip install -r requirements.txt && cd ../..

# 3. Spin up local infra (Postgres+TimescaleDB, Redis, Mosquitto)
docker compose -f infra/docker/docker-compose.yml up -d

# 4. Start the apps
pnpm --filter backend  dev   # http://localhost:3000
pnpm --filter frontend dev   # http://localhost:3001
# AI + ML services start on demand:
cd apps/ai-agents   && uvicorn src.api.server:app --port 8001
cd apps/ml-pipeline && uvicorn src.inference.server:app --port 8002
```

## Repository

```
apps/
├── backend/       NestJS API + WebSockets + MQTT ingest
├── frontend/      Next.js dashboard
├── ai-agents/     LangGraph multi-agent + MCP servers
├── ml-pipeline/   Training + inference (Chronos, PINNs, TinyML)
└── firmware/      ESP32 / Arduino sketches

packages/
├── types/         Shared TypeScript types
├── utils/         Shared TS helpers
├── api-client/    Auto-generated from backend OpenAPI
└── contracts/     Solidity smart contracts (fintech track)

infra/             Docker, scripts, deployment
docs/              Brainstorm, architecture, pitch
.claude/           Claude Code agents, skills, settings
```

## Strategy and brainstorm

See `docs/brainstorm/02_ai_trends_fintech_prep_v2.md` for the full strategy: AI trend mapping, top-7 project finalists, sponsor-bait map, pitch hooks, and the pre-hackathon prep kit.

## Claude Code agents

This project ships with four specialized Claude Code agents in `.claude/agents/`:

- **frontend-designer** — Next.js, React, Tailwind, shadcn/ui, Recharts/Plotly
- **backend-engineer** — NestJS, Prisma, TimescaleDB, MQTT, Redis
- **ai-engineer** — LangGraph multi-agent, MCP servers, RAG
- **ml-engineer** — PyTorch, Chronos foundation models, PINNs, TinyML

And seven reusable skills in `.claude/skills/`:

- `nestjs-module`, `nextjs-component`, `langgraph-workflow`, `ml-pipeline`, `mcp-server`, `iot-mqtt-pipeline`, `energy-dashboard`

## License

Private (hackathon project). Decide post-hackathon.
# nrtf
