# ReTeqFusion — IoT Sensor Pipeline

ESP32 sensor node → MQTT broker → NestJS backend → WebSocket → Next.js dashboard.

---

## Hardware

| Component | Model | Interface | GPIO |
|---|---|---|---|
| Microcontroller | ESP32 (38-pin DevKit) | — | — |
| Temperature + Humidity | DHT11 | Digital one-wire | GPIO 18 |
| Accelerometer / Gyro | MPU-6050 | I²C | SDA=21, SCL=22 |
| Flow sensor | YF-S201 | Interrupt (pulse) | GPIO 33 |

### Wiring

```
DHT11
  VCC  → 3.3V
  GND  → GND
  DATA → GPIO 18

MPU-6050
  VCC  → 3.3V
  GND  → GND
  SDA  → GPIO 21
  SCL  → GPIO 22

YF-S201
  VCC    → 5V (or 3.3V)
  GND    → GND
  SIGNAL → GPIO 33   (INPUT_PULLUP, FALLING interrupt)
```

### Flow sensor calibration

The YF-S201 emits **7.5 pulses per litre** at nominal flow.
The firmware converts pulses to L/min every 1 s:

```
flowRate = (pulseCount / 7.5) × (60 / elapsedSeconds)
```

Pulses are captured by an `IRAM_ATTR` ISR and reset each window.

---

## Firmware

**Sketch:** `apps/firmware/arduino/sketches/data-acquisition/Data_aquisition_MQTT.ino`

### Required libraries

```
WiFi              built-in ESP32 core
PubSubClient      2.8+
Adafruit_MPU6050  2.x
Adafruit_Sensor   (dependency)
DHT11             arduino-libraries/DHT11
Wire              built-in
```

### Configuration — top of the sketch

```cpp
const char* WIFI_SSID  = "YOUR_SSID";
const char* WIFI_PASS  = "";              // empty = open network
const char* MQTT_HOST  = "192.168.x.x";  // IP of the machine running Mosquitto
const int   MQTT_PORT  = 1883;
const char* MQTT_TOPIC = "esp32/sensors";
```

To find your laptop IP: `ipconfig` on Windows → look for the WiFi adapter IPv4 address.
Both the ESP32 and the laptop must be on the same WiFi network.

### MQTT client ID

Each ESP32 identifies itself with the last 4 hex digits of its eFuse MAC so two boards never collide:

```cpp
snprintf(clientId, sizeof(clientId), "ESP32_%04X", (uint16_t)(ESP.getEfuseMac() & 0xFFFF));
```

### Published payload

Every 5 samples (2.5 s) the buffer is flushed and one JSON message per sample is published on `esp32/sensors`:

```json
{"temp":24,"hum":58,"ax":0.012,"ay":-0.003,"az":9.814,"flow":1.24}
```

| Field | Unit | Sensor |
|---|---|---|
| `temp` | °C (integer) | DHT11 |
| `hum` | % RH (integer) | DHT11 |
| `ax/ay/az` | m/s² | MPU-6050 |
| `flow` | L/min | YF-S201 |

### Serial monitor output (115200 baud)

```
[INFO]  WiFi connected — IP: 192.168.1.104
[INFO]  MQTT connected to 192.168.1.203:1883
[INFO]  MPU6050 OK
[INFO]  Flow sensor on GPIO33
[INFO]  [1/5] sent: {"temp":24,"hum":58,"ax":0.012,...}
```

Set `#define DEBUG_LEVEL 2` for verbose pulse/accel logs.

---

## MQTT Broker (Mosquitto)

Runs inside Docker. **Never run a native Windows Mosquitto at the same time** — both bind `:1883` and only one wins.

```bash
docker compose -f infra/docker/docker-compose.yml up -d mosquitto
```

| Port | Protocol | Used by |
|---|---|---|
| 1883 | MQTT / TCP | ESP32, NestJS backend |
| 9001 | MQTT over WebSocket | Browser clients (optional) |

Anonymous access is on for local dev (`allow_anonymous true` in `infra/docker/mosquitto/mosquitto.conf`).

### Windows Firewall — run once as Admin

Windows blocks inbound TCP 1883 from WiFi by default. The ESP32 cannot reach the broker until you add this rule:

```powershell
netsh advfirewall firewall add rule name="MQTT 1883" dir=in action=allow protocol=TCP localport=1883
```

### Verify messages from the broker side

```bash
docker exec nrtf-mosquitto mosquitto_sub -t "esp32/sensors" -v
```

You should see a JSON line every ~2.5 s when the ESP32 is connected.

---

## Backend — NestJS

```
apps/backend/src/modules/iot/
├── iot.module.ts      registers controller, service, gateway
├── iot.service.ts     MQTT client — subscribes to esp32/sensors
├── iot.gateway.ts     Socket.IO gateway — emits sensor:update
└── iot.controller.ts  REST health endpoint
```

### Data flow

```
ESP32
  └─ WiFi ──► Mosquitto :1883   (MQTT publish)
                    │
              IoTService         (mqtt npm client, QoS 0)
              subscribes esp32/sensors
                    │
              EventEmitter2      iot.reading event
                    │
              IoTGateway         @WebSocketGateway /iot namespace
                    │
              Socket.IO          sensor:update event
                    │
              Frontend           Zustand iot-store → KPIs + charts
```

### Environment (`apps/backend/.env`)

```
NODE_ENV=development
PORT=3000
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_TOPIC=esp32/sensors
```

No leading spaces — dotenv silently breaks if there are any.

### Run

```bash
pnpm --filter backend dev      # http://localhost:3000
```

---

## Frontend — Next.js

```bash
pnpm --filter frontend dev     # http://localhost:3001
```

Connects to `http://localhost:3000/iot` (Socket.IO namespace) and listens for `sensor:update`.
State is kept in `apps/frontend/src/store/iot-store.ts` (Zustand).

### Dashboard keyboard shortcuts

| Key | Action |
|---|---|
| `F` | Flow spike → 20 L/min for 5 s |
| `A` | Temperature alert → −15 °C for 5 s, red dot on 3D model |

---

## Full stack startup

```bash
# 1. Broker + DB
docker compose -f infra/docker/docker-compose.yml up -d

# 2. Backend  (terminal 1)
pnpm --filter backend dev

# 3. Frontend  (terminal 2)
pnpm --filter frontend dev
```

Open `http://localhost:3001`. The status dot turns green once the Socket.IO handshake completes. Data appears as soon as the ESP32 publishes to `esp32/sensors`.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| ESP32 shows `rc=2` | Duplicate Mosquitto (native + Docker both on 1883) | `sc stop mosquitto` + `sc config mosquitto start= disabled`, restart backend |
| ESP32 shows `rc=5` | Broker requires auth | Set `allow_anonymous true` in mosquitto.conf |
| No messages in broker sub | Firewall blocking 1883 from WiFi | Add the `netsh` rule above |
| Dashboard dot stays orange | Backend not running or CORS | Start backend; check `NEXT_PUBLIC_BACKEND_WS_URL` |
| Flow always 0 | Wiring or 5V supply | Confirm VCC=5V, GPIO 33 pull-up, signal wire |
| MPU-6050 not found | I²C wiring wrong | Confirm SDA=21, SCL=22, 3.3V supply |
| DHT11 keeps failing | Sensor warm-up | Normal — firmware holds last valid reading |
| Port 3000 EADDRINUSE | Stale Node process | `netstat -ano | findstr :3000` → kill the PID |
