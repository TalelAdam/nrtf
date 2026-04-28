---
name: iot-mqtt-pipeline
description: Use when wiring ESP32/Arduino devices into the backend via MQTT and TimescaleDB. Trigger on "ingest sensor data from ESP32", "set up MQTT", "stream telemetry to the dashboard", "broker setup".
---

# IoT → MQTT → Backend → TimescaleDB → Dashboard Pipeline

## Topic taxonomy

```
nrtf/<deviceId>/telemetry/<metric>     # sensor readings (uplink)
nrtf/<deviceId>/event/<type>            # discrete events (uplink, e.g. fault, blackout)
nrtf/<deviceId>/cmd/<action>            # commands to device (downlink)
nrtf/<deviceId>/status                  # online/offline heartbeat (uplink, retained)
```

Examples:
- `nrtf/esp32-batt-01/telemetry/voltage` → payload: `{"v": 3.72, "ts": 1714234567}`
- `nrtf/esp32-elec-01/cmd/set_current` → payload: `{"current_a": 0.5}`
- `nrtf/esp32-elec-01/event/leak` → payload: `{"sensor": "mq8", "ppm": 1230}`

## ESP32 side (firmware contract)

- Publish telemetry every N seconds (1-5s typical).
- Include monotonically increasing `seq` field for idempotency.
- QoS 1 for telemetry, QoS 2 for commands.
- Last-will-and-testament on `nrtf/<deviceId>/status` = `"offline"`.
- Auth: client ID = device ID, password = API key issued by backend.

## Broker (Mosquitto) — infra/docker/

```yaml
# docker-compose.yml
mosquitto:
  image: eclipse-mosquitto:2
  ports:
    - "1883:1883"      # MQTT
    - "9001:9001"      # MQTT over WebSockets (for browser)
  volumes:
    - ./infra/docker/mosquitto/mosquitto.conf:/mosquitto/config/mosquitto.conf
    - ./infra/docker/mosquitto/passwd:/mosquitto/config/passwd
```

`mosquitto.conf`:
```
listener 1883
listener 9001
protocol websockets
allow_anonymous false
password_file /mosquitto/config/passwd
```

## Backend ingestion (NestJS)

```
apps/backend/src/integrations/mqtt/
├── mqtt.module.ts
├── mqtt.service.ts                # connection mgmt, subscribe wildcards
├── iot-ingest.service.ts          # subscribes nrtf/+/telemetry/+, writes to DB
└── iot-command.service.ts         # publishes commands
```

Subscribe pattern: `nrtf/+/telemetry/+`. The service parses the topic to extract `deviceId` and `metric`, validates payload with Zod, looks up the device's API key for auth, then INSERTs into TimescaleDB.

## TimescaleDB schema

```sql
CREATE TABLE readings (
    id          BIGSERIAL PRIMARY KEY,
    device_id   TEXT NOT NULL,
    metric      TEXT NOT NULL,
    value       DOUBLE PRECISION NOT NULL,
    ts          TIMESTAMPTZ NOT NULL,
    seq         INTEGER NOT NULL,
    UNIQUE (device_id, seq, metric)   -- idempotency
);

SELECT create_hypertable('readings', 'ts');
CREATE INDEX ON readings (device_id, metric, ts DESC);

CREATE TABLE events (
    id          BIGSERIAL PRIMARY KEY,
    device_id   TEXT NOT NULL,
    type        TEXT NOT NULL,
    payload     JSONB,
    ts          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE devices (
    id          TEXT PRIMARY KEY,
    name        TEXT,
    api_key_hash TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

## Dashboard real-time stream

Backend publishes to Socket.IO room `device:<deviceId>` whenever a new reading lands. Frontend subscribes:

```ts
const socket = io("/ws", { transports: ["websocket"] });
socket.emit("subscribe", { room: `device:${deviceId}` });
socket.on("reading", (r) => updateChart(r));
```

Browser MQTT (alternative for direct publish):

```ts
import mqtt from "mqtt";
const client = mqtt.connect("ws://localhost:9001");
client.subscribe("nrtf/+/telemetry/+");
client.on("message", (topic, payload) => ...);
```

Use Socket.IO bridge (preferred) — keeps auth + filtering in the backend.

## Device provisioning flow

1. User registers device via REST: `POST /api/v1/devices { name }` → backend returns `{ deviceId, apiKey }`.
2. User flashes ESP32 with the credentials (firmware reads from EEPROM or compile-time constants).
3. ESP32 connects to MQTT, publishes status `online` (retained).
4. Backend marks device `connected` and starts ingestion.

## Things NOT to do

- Don't write a custom binary protocol over TCP. MQTT is industry standard, has tooling.
- Don't poll the device from backend. Push from device, broker fans out.
- Don't store every raw reading at 1Hz forever — set up Timescale continuous aggregates (1-min, 1-hour, 1-day rollups) and a retention policy.
- Don't trust `ts` from the device for billing/financial calculations; compare against broker arrival time.

## Hackathon shortcuts

- Skip TLS on MQTT for local demo (use non-TLS port 1883).
- Skip Mosquitto password file; use `allow_anonymous true` (note this in the README).
- Skip continuous aggregates; raw table is fine for 24h.
- For < 5 devices, in-memory ringbuffer is fine; Timescale only if you want persistence past a restart.
