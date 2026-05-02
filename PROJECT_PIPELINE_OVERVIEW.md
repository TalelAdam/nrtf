# Re·Tech Fusion — Core Pipeline & Codebase Overview

> **This document covers the main pipeline and codebase structure, excluding agent/skill infrastructure and dev tooling.**

---

## 1. Project Purpose

**Re·Tech Fusion** is an end-to-end industrial energy intelligence platform. It ingests IoT sensor data, extracts and unifies information from heterogeneous energy documents, normalizes units, estimates CO₂, detects anomalies, and prioritizes waste-heat recovery — all surfaced in a modern dashboard. The stack is designed for real industrial data, resilience, and rapid hackathon iteration.

---

## 2. High-Level Architecture

```
ESP32 sensors
   │
   ▼
Mosquitto MQTT broker (Docker)
   │
   ▼
NestJS backend (IoT ingest, DB, API, WebSocket)
   │
   ├──> TimescaleDB (time-series)
   ├──> Document extraction pipeline (OCR, LLM, Excel)
   ├──> ML pipeline (forecast, anomaly)
   └──> Heat recovery engine (MCDA, ROI)
   │
   ▼
Next.js frontend (dashboard, charts, Sankey, anomaly feed)
```

---

## 3. Repository Structure (Core Only)

```
.
├── apps/
│   ├── backend/         # NestJS server: IoT ingest, API, DB, MQTT, WebSocket
│   ├── frontend/        # Next.js 14 dashboard: KPIs, charts, Sankey, anomaly feed
│   ├── ml-pipeline/     # ML models: forecasting, anomaly detection, edge export
│   ├── doc-extraction/  # OCR, LLM extraction, Excel parsing, submission API
│   ├── heat-recovery/   # Track B: waste-heat inventory, MCDA, ROI scenarios
│   ├── edge-runtime/    # TFLite-Micro export, ESP32 benchmarks
│   └── firmware/        # ESP32 PlatformIO/Arduino sketches
├── packages/            # Shared TypeScript types, utils, API client
├── data/                # GITIGNORED: raw audit, bills, Excel, processed, splits
├── models/              # GITIGNORED: checkpoints, exports
├── infra/               # Docker compose, Mosquitto, Postgres, edge targets
├── docs/                # Strategy, architecture, pitch, research
└── scripts/             # Utility scripts
```

---

## 4. Pipeline Components

### A. IoT Device & Protocol (Part 1)

- **ESP32**: Reads ≥3 sensors (flow, temperature, microwave/radio), publishes JSON via MQTT.
- **Firmware**: Arduino sketch, WiFi config, MQTT client, local buffer for reconnection.
- **MQTT Broker**: Mosquitto in Docker, port 1883, anonymous for dev.
- **Backend Ingest**: `apps/backend/src/modules/iot/` — subscribes to MQTT, emits WebSocket events, stores in TimescaleDB.

### B. Data Unification & Modeling (Part 2)

#### 1. Document Extraction

- **Input**: Native PDFs, scanned bills (JPEG/PDF), Excel reports.
- **Pipeline**:
  - File typing → branch: PDF (pdfplumber, Camelot), scanned (Tesseract/PaddleOCR + LLM), Excel (SheetJS, Polars).
  - LLM-assisted field extraction (Pydantic schema).
  - Cross-field validation, caching by SHA.
- **Output**: Unified records, normalized units, CO₂ computed.

#### 2. Unit Normalization

- **Goal**: All energy to kWh.
- **Logic**: `to_kwh(value, unit)` with provenance, strict refusal of unknown units.

#### 3. CO₂ Estimation

- **Per-row**: Carrier → emission factor (ADEME, IEA, STEG) → CO₂ (kg), scope.
- **Aggregate**: tCO₂/yr, Sankey, time series.

#### 4. Forecasting & Anomaly Detection

- **Forecast**: Chronos/LightGBM, multi-horizon (24h, 7d).
- **Anomaly**: Rolling-MAD, STL, IsolationForest, spike/dropout/stuck detection.

#### 5. Dashboard

- **Frontend**: Next.js 14, shadcn/ui, Recharts, Plotly.
- **Features**: Live IoT chart, KPI strip, Sankey, anomaly feed, Track B scenarios.

### C. Edge Intelligence & Heat Recovery (Part 3)

#### Track A (Stretch): Edge Inference

- **Goal**: Quantize forecaster to TFLite-Micro, deploy to ESP32, run on-device anomaly detection.

#### Track B (Primary): Waste-Heat Recovery

- **Inventory**: Extract heat sources from audit.
- **Characterization**: Q_recoverable, T-level, hours/yr, location.
- **MCDA**: Weighted scoring (energy, CO₂, complexity, capex, payback).
- **ROI**: Top-3 scenarios, bracketed payback.

---

## 5. Data Flow (End-to-End)

1. **Sensors** → ESP32 → MQTT → Mosquitto
2. **Backend** subscribes, validates, stores readings, emits WebSocket events
3. **Frontend** receives live updates, renders charts and KPIs
4. **Document pipeline**: User uploads bill/Excel → OCR/LLM → fields extracted → units normalized → CO₂ estimated
5. **ML pipeline**: Forecasts and anomaly scores computed, surfaced in dashboard
6. **Heat recovery**: Audit data parsed, MCDA run, ROI scenarios shown

---

## 6. Key Technologies (Core Only)

- **ESP32**: Arduino, C++
- **MQTT**: Mosquitto (Docker)
- **Backend**: NestJS 10, Fastify, Prisma, TimescaleDB, MQTT.js, Socket.IO
- **Frontend**: Next.js 14, Tailwind, shadcn/ui, Zustand, Recharts, Plotly
- **Document Extraction**: Tesseract.js, pdfplumber, SheetJS, LangChain.js, Claude Sonnet 4
- **ML**: onnxruntime-node, LightGBM, Chronos, TFLite-Micro
- **Edge**: Quantization, ESP-NN, TFLite-Micro
- **Data**: Polars, DuckDB, Parquet, Pandera, DVC
- **Infra**: Docker Compose, Mosquitto, Postgres, Redis, MLflow

---

## 7. How to Run (Dev)

1. **Start infra**:  
   `docker compose -f infra/docker/docker-compose.yml up -d`
2. **Backend**:  
   `pnpm --filter backend dev`
3. **Frontend**:  
   `pnpm --filter frontend dev`
4. **(Optional) ML pipeline**:  
   `pnpm --filter ml-pipeline dev`
5. **Open**:  
   `http://localhost:3001`

---

## 8. Further Reading

- **docs/brainstorm/STRATEGY.md** — single source of truth, scoring, architecture, playbook
- **docs/architecture/ADR-003-spec-alignment.md** — spec-aligned architecture
- **README.md** in each app for local details

---

*This overview covers the main pipeline and codebase structure, excluding agent/skill/dev infra. For deep dives, see the referenced markdown files and per-app READMEs.*
