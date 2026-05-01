# infra/edge-targets

One YAML / README per edge target — the **single source of truth for hardware budgets**.

Used by `edge-ai-optimizer` and `/quantize-model` to refuse compressions that don't fit.

## Files

- `esp32-s3.yaml` — ESP32-S3 DevKitC budget (8-16 MB flash, 512 KB SRAM + 8 MB PSRAM, 240 MHz LX7 + ESP-NN)
- `esp32-cam.yaml` — ESP32-CAM AI-Thinker budget (4 MB flash, 520 KB SRAM, OV2640)
- `raspberry-pi-5.yaml` — Pi 5 8 GB (Cortex-A76 quad @ 2.4 GHz, no NPU)
- `coral-usb.yaml` — Coral Edge TPU USB Accelerator (4 TOPS INT8, host-attached)
- `jetson-orin-nano.yaml` — Jetson Orin Nano 8 GB (1024-core Ampere + NVDLA)

## YAML schema

```yaml
target_id: raspberry-pi-5
hardware:
  cpu: ARM Cortex-A76 quad-core @ 2.4 GHz
  ram_gb: 8
  storage: SD / NVMe over PCIe
  accelerators: []  # or [coral-usb] when paired
constraints:
  flash_mb: null         # SD-card, effectively unbounded
  sram_kb: null
  ram_max_mb: 6500       # leave 1.5 GB for OS
  latency_p95_ms: 80
  power_w_max: 12
  fps_min: 10
runtimes_supported:
  - onnxruntime
  - tflite
  - llama.cpp
  - opencv
quant_schemes_supported:
  - int8-static
  - int8-dynamic
  - fp16
  - gguf-q4km
  - gguf-q5km
notes: |
  Active cooling required. Performance governor on. Swap on USB-SSD, not SD.
```

When a teammate proposes a deployment, the YAML wins arguments. Every model card cites the target file.
