# apps/edge-runtime

Owns the **model → edge hardware** path. Everything that takes a trained checkpoint and turns it into a flashable artifact lives here.

## What this app is for

- Quantization (INT8 / INT4 / FP16) — post-training and quantization-aware
- Pruning (structured + unstructured)
- Knowledge distillation (teacher → student)
- Format conversion: PyTorch → ONNX → TFLite / TFLite-Micro / TensorRT / OpenVINO / Coral / GGUF
- On-device benchmarking (latency P50/P95, peak RAM, flash, energy/inference)
- Accuracy dashboards (FP32 baseline vs every compression stage)

This is **not** where models are trained. Trained checkpoints land here from `apps/ml-pipeline/`.
This is **not** where models are served at scale. Production inference lives in `apps/ml-pipeline/src/inference/`.

## Folder layout

```
apps/edge-runtime/
├── targets/                  # YAML hardware budgets (one per device)
│   ├── esp32-s3.yaml
│   ├── raspberry-pi-5.yaml
│   ├── coral-usb.yaml
│   └── jetson-orin-nano.yaml
├── conversions/              # one script per (model × target × quant scheme)
├── distillation/             # KD recipes
├── pruning/                  # pruning configs
├── calibration/              # calibration set builders
├── benchmarks/               # on-device measurement harnesses
├── reports/                  # markdown reports per run
└── artifacts/                # produced models (gitignored — DVC or release tarball)
    ├── tflite/
    ├── tflite-micro/
    ├── onnx/
    ├── trt/
    ├── coral/
    └── gguf/
```

## Hand-off contract

Each artifact ships with three things:
1. The model file (`*.tflite`, `*.onnx`, `*.gguf`, `*.engine`, etc.)
2. A `model_card.md` — accuracy delta vs FP32, latency on target, peak RAM, flash size, calibration set used
3. An integration snippet — for MCUs, that's a `model.h` (`xxd -i` output) + tensor-arena size + init/invoke code

Owner agent: `edge-ai-optimizer`.
