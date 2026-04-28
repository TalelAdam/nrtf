# @nrtf/firmware

ESP32 + Arduino firmware for NRTF sensor nodes and actuators.

## Layout

```
esp32/                      # PlatformIO project (preferred for ESP32)
├── platformio.ini
├── src/                    # main.cpp + per-board entrypoints
├── lib/                    # local libraries (e.g., NRTFCommon)
├── include/                # headers
└── test/                   # PlatformIO unit tests
arduino/sketches/           # Arduino IDE sketches (legacy or simple boards)
```

## Setup

```bash
# Install PlatformIO Core
pip install -U platformio

# Build and upload (default env = esp32dev)
cd apps/firmware/esp32
pio run                       # build
pio run --target upload        # flash
pio device monitor             # serial console
```

## MQTT topic contract (must match backend)

```
nrtf/<deviceId>/telemetry/<metric>     # uplink readings
nrtf/<deviceId>/event/<type>            # uplink events
nrtf/<deviceId>/cmd/<action>            # downlink commands
nrtf/<deviceId>/status                  # retained heartbeat
```

See `.claude/skills/iot-mqtt-pipeline/SKILL.md` for full conventions.

## Suggested per-project sketches

- `src/battery_monitor/` — INA219 + thermistor → publish V/I/T (Thermal Runaway Sentinel, AthenaGrid)
- `src/electrolyzer_node/` — INA219 + MQ-8 + relay → publish + cmd PSU (H2-Sentinel)
- `src/greenhouse_node/` — DHT22 + BH1750 + fan/heater/servo (Greenhouse Co-Optimizer)
- `src/energy_meter/` — SCT-013 CT clamp → publish RMS power (NILM, SoukWatt prosumer)
- `src/paygo_lockbox/` — relay + pump (PaySun)
- `src/cold_chain_sentinel/` — DS18B20 + door sensor (GeniusFridge)
- `src/tinyml_nilm/` — SCT-013 + on-device TFLite Micro classifier (EdgeNILM)
