# apps/firmware/esp32-cam

Firmware for the ESP32-CAM module: camera capture + on-device CV inference via TFLite-Micro + ESP-NN.

## Hardware

- ESP32-CAM (AI-Thinker variant, OV2640 sensor) — primary
- ESP32-S3 with external camera (alternative; more SRAM + ESP-NN SIMD)
- USB-to-serial programmer (CP2102 or FTDI)

## What runs here

- Camera frame capture via `esp_camera_fb_get()` (RGB565 → grayscale or RGB888 conversion)
- On-device inference of a quantized YOLO-Pico / MobileNet-V3-tiny / person-detect model
- MQTT publish of detection results to `nrtf/<deviceId>/cv/<task>` (see `iot-mqtt-pipeline` skill)
- Optional MJPEG stream on the device's HTTP server for the dashboard fallback

## Folder layout

```
apps/firmware/esp32-cam/
├── platformio.ini
├── include/
│   └── model/
│       ├── model.h          # xxd output of the quantized .tflite
│       ├── arena_size.h     # #define TENSOR_ARENA_SIZE (KB)
│       └── model_card.md    # accuracy + latency claims
└── src/
    ├── main.cpp             # boot + WiFi + MQTT
    ├── inference.cpp        # TFLite-Micro init + invoke
    └── camera.cpp           # esp_camera setup + frame capture
```

## Build

```bash
cd apps/firmware/esp32-cam
pio run -t upload
pio device monitor -b 115200
```

## Model handoff contract

`edge-ai-optimizer` drops three files into `include/model/`:
1. `model.h` — `xxd -i model_int8.tflite > model.h`
2. `arena_size.h` — `#define TENSOR_ARENA_SIZE (240 * 1024)`
3. `model_card.md` — accuracy + latency claims

The firmware code in `src/inference.cpp` consumes these. See the `tflite-micro-esp32` skill for the standard init/invoke snippet.

Owner: IIA teammate (firmware), with `edge-ai-optimizer` for the model artifacts.
