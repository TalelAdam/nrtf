---
name: nestjs-module
description: Use when scaffolding a new NestJS feature module — controller + service + DTOs + entity + tests + optional gateway. Trigger on "create a module for X", "add a feature for Y", or any time you need a new domain object exposed via REST/WebSocket.
---

# NestJS Feature Module Scaffold

A feature module under `apps/backend/src/modules/<feature>/` follows this exact layout. The agent must create every file listed here, even if some start empty.

## Folder structure

```
src/modules/<feature>/
├── <feature>.module.ts          # NestJS @Module decorator wiring everything
├── <feature>.controller.ts      # REST endpoints
├── <feature>.gateway.ts         # WebSocket endpoints (only if real-time needed)
├── <feature>.service.ts         # business logic; injectable
├── <feature>.repository.ts      # data access; uses Prisma client (omit if direct prisma in service)
├── dto/
│   ├── create-<feature>.dto.ts
│   ├── update-<feature>.dto.ts
│   └── query-<feature>.dto.ts   # filters, pagination, sorting
├── entities/
│   └── <feature>.entity.ts      # type that mirrors DB row (Prisma generates)
├── events/
│   └── <feature>.events.ts      # event payloads (only if event-driven)
└── tests/
    ├── <feature>.service.spec.ts
    └── <feature>.controller.spec.ts
```

## Module wiring conventions

- `<feature>.module.ts` imports `PrismaModule`, `ConfigModule` as needed.
- Re-export the service from the module if other modules consume it: `exports: [<Feature>Service]`.
- Register the module in `app.module.ts` under `imports: [...]`.

## DTO conventions

- Use **class-validator** decorators on every property: `@IsString()`, `@IsUUID()`, `@IsInt()`, `@Min()`, `@Max()`, `@IsOptional()`, `@IsEnum()`, `@IsDateString()`.
- Use **class-transformer** for type coercion: `@Type(() => Number)` on query params.
- Keep `Create<Feature>Dto` and `Update<Feature>Dto` separate. `Update` can extend `PartialType(CreateDto)`.
- `Query<Feature>Dto` always includes `page`, `limit`, `sortBy`, `sortDir` with defaults.

## Controller conventions

- Decorate with `@ApiTags('<feature>')` for Swagger.
- Each route has `@ApiOperation`, `@ApiResponse` decorators.
- Use `@UseGuards(JwtAuthGuard)` by default; add `@Public()` decorator for opt-out.
- Inject service through constructor only.
- Standard verbs: `POST /` create, `GET /` list, `GET /:id` get, `PATCH /:id` update, `DELETE /:id` delete.

## Service conventions

- Inject `PrismaService` (or repository) and any other services through constructor.
- Methods are async, return typed entities (not DTOs).
- Throw `NotFoundException`, `BadRequestException`, `ConflictException`, `ForbiddenException` from `@nestjs/common`.
- Emit events via `EventEmitter2` (`@OnEvent` listeners can react).
- Use `Logger` (Nest's built-in or pino) with module name as context.

## Gateway conventions (only if real-time)

- Decorate with `@WebSocketGateway({ namespace: '<feature>' })`.
- Use `@SubscribeMessage('event-name')` for incoming.
- Use `@WebSocketServer() server: Server` to broadcast.
- Authenticate via `@UseGuards(WsJwtGuard)` — implement WS JWT guard once in `common/guards/`.

## Tests

- `<feature>.service.spec.ts` — unit tests with mocked Prisma.
- `<feature>.controller.spec.ts` — instantiate via `Test.createTestingModule()`, mock service.
- `test/e2e/<feature>.e2e-spec.ts` — Supertest hits the running app; uses test DB.

## Naming rules

- Files: `kebab-case`. Classes: `PascalCase`. Variables: `camelCase`. DB columns: `snake_case`.
- DTOs: `Create<Feature>Dto`, `Update<Feature>Dto`, `Query<Feature>Dto`.
- Service methods: `create`, `findAll`, `findOne`, `update`, `remove`.

## Example feature names for NRTF projects

- `devices` — registered ESP32/Arduino devices with API keys
- `readings` — time-series sensor readings (TimescaleDB hypertable)
- `agent-runs` — LangGraph agent execution records + traces
- `inferences` — ML model prediction logs
- `tokens` — REC / carbon credit tokens (if SolREC-Tn project)
- `auctions` — P2P energy market clearing records (if SoukWatt project)

## After scaffolding

1. Run `pnpm prisma migrate dev --name <feature>` if a new entity was added.
2. Add the module to `app.module.ts` imports.
3. Verify Swagger UI at `/docs` shows the new endpoints.
4. Write 3 e2e tests covering happy path, validation failure, and unauthorized access.
