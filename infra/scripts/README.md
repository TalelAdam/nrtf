# Infra scripts

Suggested scripts to add as the project takes shape:

- `setup.sh` — first-time installer (pnpm + python venvs + docker compose up)
- `seed.sh` — seed the DB with demo devices and historical readings
- `provision-device.sh` — register a new ESP32 with the backend, return API key
- `flash-firmware.sh` — wrap PlatformIO flash with the right env vars
- `pull-models.sh` — `ollama pull gemma2:2b phi3:mini llama3.2:3b`
- `download-datasets.sh` — fetch UK-DALE, NASA POWER (Tunis), CALCE samples
- `record-demo.sh` — start screen recording + replay a known-good run
