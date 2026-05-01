---
description: Run the model-to-edge compression workflow — calibrate, quantize, validate, hand off
argument-hint: <checkpoint-path> <target> [<quant-scheme>]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# /quantize-model — model → edge artifact

Drive the `edge-ai-optimizer` agent through one full compression cycle. Arguments:
- `<checkpoint-path>` — path to the trained model (PyTorch `.pt` / TF SavedModel / ONNX).
- `<target>` — `esp32-s3 | raspberry-pi-5 | coral-usb | jetson-orin-nano | phone`.
- `<quant-scheme>` (optional) — `int8 | fp16 | gguf-q4km | gguf-q5km`. Inferred from target if omitted.

## What this command does

1. Reads `apps/edge-runtime/targets/<target>.yaml` (creates one if missing) — flash, SRAM, latency SLO, accuracy floor.
2. Confirms / generates a calibration set under `data/calib/<task>_v<n>/` — 200-500 stratified samples.
3. Baselines FP32 export, verifies numerical parity (max abs error < 1e-3 on 100 samples).
4. Runs the quantization pipeline appropriate for the target (TFLite-Micro / ONNX-Runtime / TensorRT / GGUF).
5. Audits operator coverage on the target runtime — fails loudly on unsupported ops.
6. Runs on-device benchmark (latency P50/P95, peak RAM, flash). If hardware not connected, runs the simulator and flags the result as suggestive.
7. Generates the side-by-side accuracy report in `apps/edge-runtime/reports/<run>.md`.
8. Drops the artifact + `model_card.md` + integration snippet into `apps/firmware/<target>/include/model/` (MCU) or `models/exports/` (Pi-class).

## Output

A summary block in chat with: target, model, quant scheme, accuracy delta vs FP32, on-device latency P50/P95, peak RAM, flash, artifact path, and the one number for the deck.

## Refuses to proceed if

- No calibration set exists and no real data is reachable.
- The target YAML's accuracy floor isn't filled in.
- Operator coverage check shows any unsupported op.
- The teammate hasn't set the FP32 baseline numerical-parity green flag.

Implementation lives in the `edge-ai-optimizer` agent. Invoke with `--agent edge-ai-optimizer`.
