# models/

Trained model artifacts. **Nothing in this folder is committed to git** — use DVC or release tarballs.

## Layout

```
models/
├── checkpoints/             # PyTorch / TF training checkpoints (.pt, savedmodel)
│   └── <task>/<run_id>/
│       ├── best.pt
│       ├── last.pt
│       ├── model_card.md
│       └── config.yaml
└── exports/                 # ONNX / TFLite / TensorRT / GGUF — pre-quantization
    ├── onnx/
    ├── tflite/
    ├── trt/
    └── gguf/
```

## Hand-off

- **Pre-quantization exports** land in `models/exports/`. ONNX-FP32 + TFLite-FP32. From here, `edge-ai-optimizer` produces the quantized artifacts in `apps/edge-runtime/artifacts/`.
- **Final edge artifacts** are in `apps/edge-runtime/artifacts/` (one subdir per format).
- **Model cards** live next to the checkpoint in `checkpoints/<task>/<run_id>/model_card.md` — accuracy, dataset, training procedure, evaluation, limitations.

## Why two folders for artifacts

- `models/exports/` = formats produced by training (ONNX FP32 / TFLite FP32). Stable, reusable.
- `apps/edge-runtime/artifacts/` = formats produced by compression (INT8 / GGUF / TensorRT engines). Target-specific.

Don't put quantized artifacts here. They go in `apps/edge-runtime/artifacts/`.
