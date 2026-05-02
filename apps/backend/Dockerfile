# ─── Builder ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

# Copy entire monorepo (node_modules excluded via .dockerignore)
COPY . .

# Install all dependencies (hoisted so @nestjs/cli resolves from root)
RUN pnpm install --no-frozen-lockfile --shamefully-hoist

# Build NestJS from backend directory using explicit nest path
WORKDIR /app/apps/backend
RUN node /app/node_modules/@nestjs/cli/bin/nest.js build

# ─── Runner ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/contracts/package.json ./packages/contracts/

RUN pnpm install --no-frozen-lockfile --prod --shamefully-hoist

COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY packages/ ./packages/

WORKDIR /app/apps/backend

EXPOSE 3000
CMD ["node", "dist/main"]
