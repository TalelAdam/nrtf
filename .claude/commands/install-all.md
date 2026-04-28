---
description: Install all dependencies across the monorepo (pnpm + python venvs)
---

Run the full install for every workspace:

1. **JS workspaces (pnpm):**
   ```bash
   pnpm install
   ```

2. **Python AI agents:**
   ```bash
   cd apps/ai-agents
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   cd ../..
   ```

3. **Python ML pipeline:**
   ```bash
   cd apps/ml-pipeline
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   cd ../..
   ```

4. **PlatformIO (firmware):**
   ```bash
   pip install -U platformio
   cd apps/firmware/esp32 && pio pkg install && cd ../../..
   ```

5. **Docker infra:**
   ```bash
   docker compose -f infra/docker/docker-compose.yml up -d
   ```

After install, run `pnpm dev` to start backend + frontend together.
