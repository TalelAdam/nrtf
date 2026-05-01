---
name: edge-quantization
description: Use when compressing a trained model for edge deployment — INT8 / INT4 / FP16 post-training quantization, quantization-aware training, calibration set design, accuracy delta tracking. Trigger on "quantize this model", "shrink to int8", "PTQ vs QAT", "calibrate quantization", "the model is too big for the chip".
---

# Edge Quantization Workflow

The decision-tree-and-recipe companion for `edge-ai-optimizer`. Use when an FP32 PyTorch / TF model needs to land on an edge target.

## Decision tree

```
Target = MCU (ESP32 / Cortex-M)?       → INT8 full-integer + TFLite-Micro. No exceptions.
Target = Pi-class CPU?                 → INT8 dynamic (fast path) or INT8 static (better accuracy).
Target = mobile NPU (ANE / Hexagon)?   → FP16 first; INT8 only if NPU supports it natively.
Target = Edge TPU (Coral)?             → INT8 full-integer, QAT preferred.
Target = Jetson?                       → FP16 default (TensorRT). INT8 if calibration set is solid.
Target = Pi/phone running an LLM?      → GGUF Q4_K_M default; Q5_K_M if quality matters; Q8_0 for headroom.
```

## Calibration set design (this is where most teams fail)

- **200–500 samples** drawn from the *deployment distribution*, not the training set.
- Stratified: cover all classes, all time-of-day, all camera angles, all sensors.
- Stored under `data/calib/<task>_v<n>/` with a `manifest.json` describing the strata.
- Re-roll the calibration set if the deployment distribution changes (new camera, new shift, new product line).

```python
# Stratified calibration sample for a vision task
import polars as pl, random, shutil
random.seed(0)
df = pl.read_parquet("data/processed/frame_index.parquet")
strata = df.partition_by(["camera_id", "shift"], as_dict=True)
calib = []
for key, sub in strata.items():
    n_per = max(1, 500 // len(strata))
    calib.extend(sub.sample(n=min(n_per, len(sub)), seed=0).get_column("frame_path"))
for p in calib:
    shutil.copy(p, "data/calib/ppe_v1/")
```

## PTQ in PyTorch FX (the boring strong default)

```python
import torch
from torch.ao.quantization import (
    QConfigMapping, get_default_qconfig, prepare_fx, convert_fx,
)
from torch.export import export

model.eval()
qconfig_mapping = QConfigMapping().set_global(get_default_qconfig("x86"))
example_inputs = (torch.randn(1, 3, 224, 224),)
prepared = prepare_fx(model, qconfig_mapping, example_inputs)
# calibrate
for batch in calib_loader:
    prepared(batch)
quantized = convert_fx(prepared)

# verify accuracy delta on val set, log to mlflow
```

## TFLite INT8 PTQ (TensorFlow path)

```python
import tensorflow as tf

def representative():
    for x, _ in calib_dataset.take(500):
        yield [tf.cast(x, tf.float32)]

converter = tf.lite.TFLiteConverter.from_saved_model("model_savedmodel")
converter.optimizations = [tf.lite.Optimize.DEFAULT]
converter.representative_dataset = representative
converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
converter.inference_input_type = tf.int8
converter.inference_output_type = tf.int8
tflite = converter.convert()
open("model_int8.tflite", "wb").write(tflite)
```

## PyTorch → TFLite-direct (skip TF)

```python
import ai_edge_torch  # google-ai-edge / ai-edge-torch
edge_model = ai_edge_torch.convert(
    model.eval(),
    sample_inputs=(torch.randn(1, 3, 224, 224),),
    quant_config=ai_edge_torch.quantize.PT2EQuantizationConfig(),
)
edge_model.export("model_int8.tflite")
```

## ONNX-Runtime static INT8 (Pi-class CPU)

```python
from onnxruntime.quantization import quantize_static, CalibrationDataReader

class CDR(CalibrationDataReader):
    def __init__(self, samples): self.it = iter(samples)
    def get_next(self): return next(self.it, None)

quantize_static("model.onnx", "model.int8.onnx", CDR(calib_samples),
                per_channel=True, activation_type=QuantType.QInt8, weight_type=QuantType.QInt8)
```

## QAT (when PTQ accuracy collapses)

Cost: ~ 1 epoch of fine-tuning. Recipe:

```python
from torch.ao.quantization import prepare_qat_fx
qat = prepare_qat_fx(model, qconfig_mapping, example_inputs)
optimizer = torch.optim.Adam(qat.parameters(), lr=1e-5)
for epoch in range(1):
    for x, y in train_loader:
        optimizer.zero_grad()
        loss = criterion(qat(x), y)
        loss.backward()
        optimizer.step()
quantized = convert_fx(qat.eval())
```

## Accuracy report contract

Every quantization run produces `apps/edge-runtime/reports/<run>.md` with:

```
| Stage             | Top-1  | mAP@0.5 | Latency P95 | Size  |
|-------------------|-------:|--------:|------------:|------:|
| FP32 baseline     | 0.912  | 0.864   | 124 ms      | 86 MB |
| FP16              | 0.911  | 0.863   | 71 ms       | 43 MB |
| INT8 (PTQ)        | 0.901  | 0.847   | 28 ms       | 22 MB |
| INT8 on Pi 5      | 0.901  | 0.847   | 41 ms       | 22 MB |
```

If any row drops > 2% from the previous row, document why before chaining the next stage.

## Things NOT to do

- Don't quantize without verifying FP32 numerical parity first (max abs error < 1e-3 on 100 samples after a no-op conversion pass).
- Don't reuse the training set for calibration. Calibration ≠ training.
- Don't quantize layers the runtime can't kernel-back. Audit ops first.
- Don't ship a quantized model whose on-device accuracy hasn't been measured on the actual chip.

## Hackathon shortcuts

- `ai_edge_torch` for PyTorch → TFLite in one call.
- `optimum-quanto` for HF transformers → INT8 in three lines.
- For LLMs, skip everything above and go to `llm-edge-deployment` skill.
