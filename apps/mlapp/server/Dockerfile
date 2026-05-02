# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — dependency builder
#   Installs Python packages into a clean prefix so the final image stays lean.
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Copy only the dependency manifest first so Docker can cache this layer
# independently of source-code changes.
COPY requirements.txt .

RUN pip install --upgrade pip \
 && pip install --prefix=/install --no-cache-dir -r requirements.txt


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — runtime image
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Non-root user for security.
RUN useradd --create-home mlapp
WORKDIR /app

# Copy installed packages from the builder stage.
COPY --from=builder /install /usr/local

# Copy application source.
COPY main.py .

# Drop privileges before starting the server.
USER mlapp

# ── environment defaults (override via docker run -e or docker-compose) ───────
ENV PORT=8002 \
    HOST=0.0.0.0 \
    WORKERS=1 \
    MODEL_NAME=stub-identity-v1 \
    MODEL_VERSION=0.0.1 \
    CORS_ORIGINS=*

EXPOSE ${PORT}

# Healthcheck so Docker / Compose knows when the server is live.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen(f'http://localhost:${PORT}/healthz')"

# Use shell form so ${PORT} / ${WORKERS} expansion works at container runtime.
CMD uvicorn main:app \
    --host ${HOST} \
    --port ${PORT} \
    --workers ${WORKERS} \
    --log-level info
