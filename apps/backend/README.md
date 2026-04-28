# @nrtf/backend

NestJS 10 + Fastify backend for NRTF.

## Layout

```
src/
├── main.ts                       # bootstrap
├── app.module.ts                 # root module
├── modules/                      # feature modules (one folder each)
├── common/                       # shared decorators, filters, guards, pipes, interceptors
├── config/                       # @nestjs/config schemas
├── database/                     # migrations, seeds
├── integrations/                 # external systems
│   ├── mqtt/                     # Mosquitto subscriber/publisher
│   ├── blockchain/               # viem clients, contracts
│   └── ai-bridge/                # HTTP client to ai-agents and ml-pipeline
├── shared/                       # cross-module utilities
test/
├── e2e/
└── unit/
```

## Module pattern

See `.claude/skills/nestjs-module/SKILL.md` for the canonical pattern.

## Setup

```bash
cp .env.example .env
pnpm install
pnpm prisma generate
pnpm prisma migrate dev
pnpm dev
```

API docs auto-served at `/docs`.
