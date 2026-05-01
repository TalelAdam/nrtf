---
name: tflite-micro-esp32
description: Use when deploying a TFLite model to an ESP32 / ESP32-S3 / ESP32-CAM via TFLite-Micro and ESP-NN. Trigger on "deploy to ESP32", "TFLite-Micro", "model.h", "tensor arena", "ESP-NN", "person detection on ESP32", "fit in 512 KB SRAM".
---

# TFLite-Micro on ESP32-S3

The handoff pattern from `edge-ai-optimizer` to the firmware teammate. Lives between the quantized `.tflite` and a flashable ESP-IDF project.

## The four artifacts (in this order)

1. **`model.tflite`** — INT8 full-integer TFLite model (no float ops anywhere).
2. **`model.h`** — C array of the model bytes: `xxd -i model.tflite > model.h`.
3. **`tensor_arena_size`** — peak RAM the model needs at runtime (in KB). Get it from `tflite_micro_benchmarker`.
4. **An init/invoke snippet** — the 30 lines the firmware teammate copies into the ESP-IDF project.

## Folder layout (firmware side)

```
apps/firmware/esp32-cam/
├── platformio.ini
├── include/
│   └── model/
│       ├── model.h           # the xxd output
│       ├── model_card.md     # accuracy, latency, calibration
│       └── arena_size.h      # #define TENSOR_ARENA_SIZE 240*1024
└── src/
    └── inference.cpp         # init/invoke snippet
```

## Standard inference snippet (ESP-IDF + ESP-NN)

```cpp
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/micro/micro_mutable_op_resolver.h"
#include "tensorflow/lite/schema/schema_generated.h"
#include "esp_nn.h"
#include "model/model.h"
#include "model/arena_size.h"

namespace {
  alignas(16) uint8_t tensor_arena[TENSOR_ARENA_SIZE];
  const tflite::Model* model = nullptr;
  tflite::MicroInterpreter* interpreter = nullptr;
}

void model_init() {
  model = tflite::GetModel(g_model);
  static tflite::MicroMutableOpResolver<8> resolver;
  resolver.AddConv2D();
  resolver.AddDepthwiseConv2D();
  resolver.AddMaxPool2D();
  resolver.AddReshape();
  resolver.AddSoftmax();
  resolver.AddLogistic();
  resolver.AddAdd();
  resolver.AddMean();
  static tflite::MicroInterpreter static_interpreter(
      model, resolver, tensor_arena, TENSOR_ARENA_SIZE);
  interpreter = &static_interpreter;
  interpreter->AllocateTensors();
}

bool model_infer(const int8_t* input, int8_t* output, size_t out_len) {
  TfLiteTensor* in = interpreter->input(0);
  memcpy(in->data.int8, input, in->bytes);
  if (interpreter->Invoke() != kTfLiteOk) return false;
  TfLiteTensor* out = interpreter->output(0);
  memcpy(output, out->data.int8, out_len);
  return true;
}
```

## Op resolver — only the ops your model uses

`AddConv2D / AddDepthwiseConv2D / AddSoftmax` etc. — keep this list minimal. Each op pulls in code; over-resolving wastes flash. Generate the list with `tflite_visualize` or grep the model.

## Tensor arena sizing

- Run `tflite_micro_benchmarker` against the `.tflite` to get a *suggested* arena size.
- On-device, allocate **+10–20% headroom**. Out-of-arena = silent failure.
- For ESP32-S3 with PSRAM: large arenas can live in PSRAM (slower); inputs/outputs in SRAM. Use `ESP_NN_HEAP_CAPS_INTERNAL` or partition manually.

## ESP-NN — the SIMD speedup

ESP-NN is Espressif's SIMD-optimized op kernel pack for ESP32-S3. Enable in PlatformIO:

```ini
; platformio.ini
[env:esp32-s3-devkitc-1]
platform = espressif32
board = esp32-s3-devkitc-1
framework = espidf
build_flags =
  -DCONFIG_NN_OPTIMIZED=1
  -DCONFIG_NN_OPTIMIZATIONS_ESP32_S3=1
lib_deps =
  espressif/esp-tflite-micro@^1.3.3
  espressif/esp-nn
```

ESP-NN delivers 3-10× speedup on Conv2D / DepthwiseConv2D for INT8. **Always enable on ESP32-S3.**

## Camera input (ESP32-CAM specific)

```cpp
camera_fb_t* fb = esp_camera_fb_get();
// ESP32-CAM gives RGB565 by default; convert to int8 grayscale or RGB888 then quantize
// Match the model's expected input shape exactly (96x96, 160x160, 192x192, etc.)
```

For YOLOv8n at 320×320, ESP32-S3 will deliver ~ 2-4 FPS realistic. For person-detect at 96×96, expect 8-15 FPS.

## Memory budget worksheet (paste into the model card)

```
Model size (flash):        ____ KB / 8 MB available
Tensor arena (SRAM):       ____ KB / 512 KB available
Camera frame buffer:       ____ KB
WiFi stack + heap:         ~ 80 KB
ESP-IDF baseline:          ~ 100 KB
=========
Total used:                ____ KB
Headroom:                  ____ KB (target ≥ 50 KB)
```

If headroom drops below 50 KB, the device will OOM under WiFi load. Shrink the model.

## Things NOT to do

- Don't run float ops in TFLite-Micro on ESP32. The micro runtime has no FP kernel by default — every float op silently falls back to a slow software path.
- Don't allocate the tensor arena on the heap (`new uint8_t[N]`). Use a static `alignas(16) uint8_t arena[N];`.
- Don't bring in `MicroAllOpsResolver`. Adds ~ 60 KB of unused op code. Use `MicroMutableOpResolver<N>` and add only what you need.
- Don't enable WiFi + camera + inference on a vanilla ESP32 (520 KB SRAM). Use ESP32-S3 with PSRAM.
- Don't ship without measuring on the actual board. Simulator latency lies.

## Hackathon shortcuts

- For person-detect: `esp-who` ships a pre-trained model that fits in ~ 250 KB. Use it as the H1 baseline; replace with your own student in H10.
- For KWS (keyword spotting): Edge Impulse's "Continuous Audio Sampling" template is plug-and-play.
- Use `idf.py monitor` to watch arena allocation logs (`AllocateTensors` prints peak RAM).
