"""
mlapp/server — FastAPI inference server
========================================
Provides a thin HTTP wrapper around ML model inference so any team
service (NestJS backend, LangGraph agents, notebooks) can call it over
a simple REST interface.

Routes
------
GET  /healthz          → liveness probe
GET  /readyz            → readiness probe (returns 503 until model loaded)
POST /predict           → run a single inference
POST /predict/batch     → run a batch of inferences
GET  /model/info        → describe the currently-loaded model
"""

from __future__ import annotations

import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("mlapp.server")

# ---------------------------------------------------------------------------
# In-memory "model" registry
# ---------------------------------------------------------------------------
# Replace this stub with your real model loader (ONNX, TFLite, LightGBM …).
# The pattern: load once at startup, expose via module-level dict so routes
# can grab it without passing state around.

_model_registry: dict[str, Any] = {}


def load_model() -> None:
    """
    Load (or hot-reload) the model into `_model_registry`.

    Swap the body of this function with your real loading logic, e.g.:

        import onnxruntime as ort
        sess = ort.InferenceSession("model.onnx")
        _model_registry["session"] = sess
        _model_registry["input_name"] = sess.get_inputs()[0].name
    """
    logger.info("Loading model …")
    # --- STUB: identity model that just echoes the input back ---
    _model_registry["session"] = "stub"
    _model_registry["name"] = os.getenv("MODEL_NAME", "stub-identity-v1")
    _model_registry["version"] = os.getenv("MODEL_VERSION", "0.0.1")
    _model_registry["loaded_at"] = time.time()
    logger.info("Model loaded: %s %s", _model_registry["name"], _model_registry["version"])


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield
    _model_registry.clear()
    logger.info("Model registry cleared on shutdown.")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="mlapp · inference server",
    description="Dockerized FastAPI wrapper for ML model inference (NRTF hackathon).",
    version="0.1.0",
    lifespan=lifespan,
)

# Allow the NestJS backend and Next.js frontend to reach this service.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class PredictRequest(BaseModel):
    """Payload for a single inference call."""

    features: list[float] = Field(
        ...,
        description="Feature vector (float list). Shape must match the model's input.",
        example=[1.0, 2.5, 0.3, 42.0],
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional caller-provided context echoed back in the response.",
    )


class PredictResponse(BaseModel):
    """Result of a single inference call."""

    prediction: list[float] = Field(..., description="Model output vector.")
    model_name: str
    model_version: str
    latency_ms: float = Field(..., description="Server-side inference latency in ms.")
    metadata: dict[str, Any]


class BatchPredictRequest(BaseModel):
    """Payload for a batched inference call."""

    instances: list[PredictRequest] = Field(..., min_length=1, max_length=256)


class BatchPredictResponse(BaseModel):
    results: list[PredictResponse]
    total_latency_ms: float


class ModelInfo(BaseModel):
    name: str
    version: str
    loaded_at: float
    status: str


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _run_inference(features: list[float]) -> list[float]:
    """
    Run the loaded model on a single feature vector and return the output.

    Replace the stub logic with your real inference call:

        session = _model_registry["session"]
        input_name = _model_registry["input_name"]
        arr = np.array([features], dtype=np.float32)
        output = session.run(None, {input_name: arr})
        return output[0][0].tolist()
    """
    if not _model_registry:
        raise RuntimeError("Model not loaded.")
    # STUB: return the negated input as a fake "prediction"
    return (np.array(features) * -1).tolist()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/healthz", tags=["ops"], summary="Liveness probe")
async def healthz():
    """Always returns 200 while the process is alive."""
    return {"status": "ok"}


@app.get("/readyz", tags=["ops"], summary="Readiness probe")
async def readyz():
    """Returns 200 only after the model has been loaded successfully."""
    if not _model_registry:
        raise HTTPException(status_code=503, detail="Model not yet loaded.")
    return {"status": "ready"}


@app.get("/model/info", response_model=ModelInfo, tags=["model"], summary="Describe loaded model")
async def model_info():
    """Return metadata about the currently-loaded model."""
    if not _model_registry:
        raise HTTPException(status_code=503, detail="No model loaded.")
    return ModelInfo(
        name=_model_registry["name"],
        version=_model_registry["version"],
        loaded_at=_model_registry["loaded_at"],
        status="loaded",
    )


@app.post("/predict", response_model=PredictResponse, tags=["inference"], summary="Single inference")
async def predict(body: PredictRequest):
    """
    Run inference on a single feature vector.

    The `features` list must match the dimensionality expected by the loaded
    model. Swap `_run_inference` with your real model call.
    """
    t0 = time.perf_counter()
    try:
        prediction = _run_inference(body.features)
    except Exception as exc:
        logger.exception("Inference failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    latency_ms = (time.perf_counter() - t0) * 1000

    return PredictResponse(
        prediction=prediction,
        model_name=_model_registry["name"],
        model_version=_model_registry["version"],
        latency_ms=round(latency_ms, 3),
        metadata=body.metadata,
    )


@app.post(
    "/predict/batch",
    response_model=BatchPredictResponse,
    tags=["inference"],
    summary="Batched inference",
)
async def predict_batch(body: BatchPredictRequest):
    """
    Run inference on a list of up to 256 feature vectors in one call.

    Each instance is processed independently by `_run_inference`. For models
    that support native batching (e.g. ONNX with dynamic axes) you can
    vectorise the loop for better throughput.
    """
    t0 = time.perf_counter()
    results: list[PredictResponse] = []

    for instance in body.instances:
        inst_t0 = time.perf_counter()
        try:
            prediction = _run_inference(instance.features)
        except Exception as exc:
            logger.exception("Batch inference failed on instance")
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        inst_latency = (time.perf_counter() - inst_t0) * 1000
        results.append(
            PredictResponse(
                prediction=prediction,
                model_name=_model_registry["name"],
                model_version=_model_registry["version"],
                latency_ms=round(inst_latency, 3),
                metadata=instance.metadata,
            )
        )

    total_latency_ms = (time.perf_counter() - t0) * 1000
    return BatchPredictResponse(results=results, total_latency_ms=round(total_latency_ms, 3))


# ---------------------------------------------------------------------------
# Global exception handler (keeps error shapes consistent)
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})
