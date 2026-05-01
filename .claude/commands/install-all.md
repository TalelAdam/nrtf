---
description: Install all dependencies across the monorepo (pnpm + python venvs + platformio + edge toolchain)
---

Run the full install for every workspace.

## 1. JS workspaces (pnpm)
```bash
pnpm install
```

## 2. Python — AI agents (cloud LLM orchestration + MCP)
```bash
cd apps/ai-agents
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ../..
```

## 3. Python — ML pipeline (training + inference of forecasters / PINNs)
```bash
cd apps/ml-pipeline
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ../..
```

## 4. Python — CV pipeline (post-leak; YOLO + ByteTrack + serving)
```bash
cd apps/cv-pipeline
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Common deps if requirements.txt missing:
#   pip install ultralytics opencv-python decord supervision \
#               fastapi uvicorn pydantic albumentations
cd ../..
```

## 5. Python — edge runtime (post-leak; quantization + distillation + benchmarks)
```bash
cd apps/edge-runtime
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Common deps if requirements.txt missing:
#   pip install torch onnx onnxruntime onnxsim ai-edge-torch tensorflow \
#               torchdistill optimum bitsandbytes
cd ../..
```

## 6. PlatformIO + ESP toolchain (firmware)
```bash
pip install -U platformio
cd apps/firmware/esp32     && pio pkg install && cd ../../..
cd apps/firmware/esp32-cam && pio pkg install && cd ../../..
```

## 7. llama.cpp (edge LLM — for Pi 5 deployments + dev iteration)
```bash
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp && make -j8 LLAMA_OPENBLAS=1 && cd ..
```

On the Pi 5 (post-cross-build), the same recipe with:
```bash
make -j4 LLAMA_OPENBLAS=1 \
  CFLAGS="-O3 -march=armv8.4-a+dotprod" \
  CXXFLAGS="-O3 -march=armv8.4-a+dotprod"
```

## 8. DVC (data versioning)
```bash
pip install "dvc[s3]"
dvc init  # if not already
```

## 9. Docker infra (Mosquitto + Postgres+Timescale + Redis + MLflow + Ollama)
```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

After install, run `pnpm dev` to start backend + frontend, and start the Python services per `CLAUDE.md` "Daily / sprint commands."
