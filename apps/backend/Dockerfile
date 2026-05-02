# ─── Builder ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

# Copy workspace config (npmrc needed for shamefully-hoist lockfile compat)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/contracts/package.json ./packages/contracts/

RUN pnpm install --frozen-lockfile

# Copy only backend + shared source
COPY apps/backend/ ./apps/backend/
COPY packages/ ./packages/

WORKDIR /app/apps/backend
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm exec tsc -p tsconfig.json

# ─── Runner ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Only need the compiled output + production deps
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/
COPY --from=builder /app/packages ./packages

WORKDIR /app/apps/backend
EXPOSE 3000
CMD ["node", "dist/main"]
