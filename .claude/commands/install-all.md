---
description: Install all dependencies across the monorepo (pnpm + python venvs + platformio + edge toolchain)
---

Run the full install for every workspace.

## 1. JS workspaces (pnpm)
```bash
pnpm install
```

## 2. Python — AI agents (LangGraph orchestrator)
```bash
cd apps/ai-agents
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ../..
```

## 3. Python — ML pipeline (forecasting + anomaly + Part 3A predictor)
```bash
cd apps/ml-pipeline
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ../..
```

## 4. Python — Document extraction (Part 2 §2.1: OCR + LLM extraction + submission)
```bash
cd apps/doc-extraction
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Common deps if requirements.txt missing:
#   pip install paddleocr pytesseract pdfplumber pdf2image \
#               polars openpyxl pandera \
#               langchain-anthropic pydantic \
#               fastapi uvicorn opencv-python diskcache httpx
cd ../..
```

## 5. Python — Heat recovery (Track B)
```bash
cd apps/heat-recovery
python -m venv .venv && source .venv/bin/activate
pip install polars numpy pandas matplotlib jupyter
cd ../..
```

## 6. Python — Edge runtime (Track A: quantize → TFLite-Micro)
```bash
cd apps/edge-runtime
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Common deps if requirements.txt missing:
#   pip install torch onnx onnxruntime ai-edge-torch tensorflow
cd ../..
```

## 7. PlatformIO + ESP toolchain (firmware — Part 1 + Track A)
```bash
pip install -U platformio
cd apps/firmware/esp32 && pio pkg install && cd ../../..
```

## 8. DVC (data versioning)
```bash
pip install "dvc[s3]"
dvc init  # if not already
```

## 9. Docker infra (Mosquitto + Postgres+Timescale + Redis + MLflow)
```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

After install: `pnpm dev` for backend+frontend, then start the Python services per `CLAUDE.md` "Daily / sprint commands."
