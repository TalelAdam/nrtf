---
description: Benchmark a model on actual edge hardware — latency, RAM, flash, energy
argument-hint: <artifact-path> <target> [<n-runs>]
allowed-tools: Read, Bash, Edit
---

# /profile-edge — on-device benchmark

Run a model artifact on the actual target hardware and produce a benchmark report. Arguments:
- `<artifact-path>` — `*.tflite | *.onnx | *.engine | *.gguf`.
- `<target>` — same target list as `/quantize-model`.
- `<n-runs>` (optional, default 100) — inferences to time.

## What this command does

1. Discovers the target hardware (USB / IP / serial). For ESP32-class, expects PlatformIO / esp-idf flash + monitor. For Pi 5 / Jetson, expects SSH.
2. Flashes / copies the artifact.
3. Runs N warm-up inferences (discarded) + N timed inferences.
4. Records: latency P50, P95, P99; peak RAM; flash footprint; (if INA219 in the rig) energy per inference in mJ.
5. Cross-checks accuracy on a 100-sample held-out slice (`data/eval/<task>/sample.parquet`).
6. Appends to `apps/edge-runtime/reports/<run>.md` and prints a one-line summary.

## Output

```
Pi 5 (INT8) | YOLOv8n imgsz=640 | P50=34ms P95=48ms RAM=180MB Size=22MB | mAP@0.5=0.847
```

Implementation lives in `apps/edge-runtime/benchmarks/`. Owner: `edge-ai-optimizer`.
