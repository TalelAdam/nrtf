# ─── Builder ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

# Build-time env vars for Next.js
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ARG NEXT_PUBLIC_BACKEND_WS_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BACKEND_WS_URL=$NEXT_PUBLIC_BACKEND_WS_URL

# Copy workspace config + npmrc for shameful hoisting
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

# Copy all package manifests
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/contracts/package.json ./packages/contracts/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/frontend/ ./apps/frontend/
COPY packages/ ./packages/

# Build Next.js (standalone output)
WORKDIR /app/apps/frontend
RUN pnpm build

# ─── Runner ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

EXPOSE 3001
CMD ["node", "apps/frontend/server.js"]
