# mlapp · inference server

A lightweight, Dockerized **FastAPI** service that exposes ML model inference over HTTP.  
Designed to be called by the NestJS backend, LangGraph agents, or any HTTP client.

---

## Folder layout

```
apps/mlapp/server/
├── main.py              ← FastAPI app (routes, schemas, model stub)
├── requirements.txt     ← Python dependencies
├── Dockerfile           ← Multi-stage build (builder + lean runtime)
├── docker-compose.yml   ← One-command local run
├── .env.example         ← Environment variable reference
└── README.md            ← You are here
```

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/healthz` | Liveness probe — always 200 while the process is alive |
| `GET` | `/readyz` | Readiness probe — 503 until the model finishes loading |
| `GET` | `/model/info` | Metadata about the currently-loaded model |
| `POST` | `/predict` | Single inference |
| `POST` | `/predict/batch` | Batch inference (up to 256 instances) |

Interactive docs are served automatically at **`/docs`** (Swagger UI) and **`/redoc`**.

### `POST /predict`

**Request body**
```json
{
  "features": [1.0, 2.5, 0.3, 42.0],
  "metadata": { "sensor_id": "ESP32-01" }
}
```

**Response**
```json
{
  "prediction": [-1.0, -2.5, -0.3, -42.0],
  "model_name": "stub-identity-v1",
  "model_version": "0.0.1",
  "latency_ms": 0.123,
  "metadata": { "sensor_id": "ESP32-01" }
}
```

### `POST /predict/batch`

**Request body**
```json
{
  "instances": [
    { "features": [1.0, 2.0], "metadata": {} },
    { "features": [3.0, 4.0], "metadata": {} }
  ]
}
```

**Response**
```json
{
  "results": [ { "prediction": [...], ... }, { "prediction": [...], ... } ],
  "total_latency_ms": 0.456
}
```

---

## Quickstart

### Option A — Docker Compose (recommended)

```bash
# From the repo root, create the shared Docker network if it doesn't exist yet
docker network create nrtf_default

# Build and start
cd apps/mlapp/server
cp .env.example .env          # edit if needed
docker compose up --build
```

The server is live at **http://localhost:8002**.  
Swagger UI: http://localhost:8002/docs

### Option B — Local Python (no Docker)

```bash
cd apps/mlapp/server
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8002
```

---

## Sending requests

```bash
# Liveness
curl http://localhost:8002/healthz

# Model info
curl http://localhost:8002/model/info

# Single prediction
curl -X POST http://localhost:8002/predict \
  -H "Content-Type: application/json" \
  -d '{"features": [1.0, 2.5, 0.3, 42.0], "metadata": {}}'

# Batch prediction
curl -X POST http://localhost:8002/predict/batch \
  -H "Content-Type: application/json" \
  -d '{"instances": [{"features": [1.0, 2.0], "metadata": {}}, {"features": [3.0, 4.0], "metadata": {}}]}'
```

---

## Plugging in a real model

The stub in `main.py` simply negates the input vector. To use a real model:

1. **Load it** in `load_model()` — examples are in the docstring.
2. **Run it** in `_run_inference()` — replace the stub with your ONNX / LightGBM / sklearn call.
3. Rebuild the image: `docker compose up --build`.

**ONNX example:**
```python
import onnxruntime as ort, numpy as np

def load_model():
    sess = ort.InferenceSession("/app/models/forecaster.onnx")
    _model_registry["session"] = sess
    _model_registry["input_name"] = sess.get_inputs()[0].name
    ...

def _run_inference(features):
    sess = _model_registry["session"]
    arr = np.array([features], dtype=np.float32)
    return sess.run(None, {_model_registry["input_name"]: arr})[0][0].tolist()
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8002` | Port the server listens on |
| `WORKERS` | `1` | Uvicorn worker count (keep 1 for in-process model state) |
| `MODEL_NAME` | `stub-identity-v1` | Logged in `/model/info` response |
| `MODEL_VERSION` | `0.0.1` | Logged in `/model/info` response |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |

---

## Integration with the NestJS backend

The NestJS `ai-bridge` module can reach this service at  
`http://mlapp_server:8002` inside the Docker network (`nrtf_default`).

```typescript
// apps/backend/src/ai-bridge/ml.client.ts (example)
const res = await fetch('http://mlapp_server:8002/predict', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ features: readingVector }),
});
const { prediction } = await res.json();
```
