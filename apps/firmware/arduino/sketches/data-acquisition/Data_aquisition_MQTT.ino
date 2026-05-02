#include <Wire.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <DHT11.h>

// ─────────────────────────────────────────
//  CONFIG — change these two lines only
// ─────────────────────────────────────────
const char* WIFI_SSID     = "WIFI-RIV";
const char* WIFI_PASS     = "";                  // empty = open network
const char* MQTT_HOST     = "192.168.1.203";     // Talel's laptop IP
const int   MQTT_PORT     = 1883;
const char* MQTT_TOPIC    = "esp32/sensors";

// ─────────────────────────────────────────
//  DEBUG LEVELS  0=off 1=info 2=verbose
// ─────────────────────────────────────────
#define DEBUG_LEVEL 1

#define LOG_INFO(fmt, ...)    if (DEBUG_LEVEL >= 1) { Serial.printf("[INFO]  " fmt "\n", ##__VA_ARGS__); }
#define LOG_VERBOSE(fmt, ...) if (DEBUG_LEVEL >= 2) { Serial.printf("[VERB]  " fmt "\n", ##__VA_ARGS__); }
#define LOG_WARN(fmt, ...)    if (DEBUG_LEVEL >= 1) { Serial.printf("[WARN]  " fmt "\n", ##__VA_ARGS__); }
#define LOG_ERROR(fmt, ...)                          { Serial.printf("[ERROR] " fmt "\n", ##__VA_ARGS__); }

// ─────────────────────────────────────────
//  BUFFER CONFIG
// ─────────────────────────────────────────
#define BUFFER_SIZE        5    // samples before flush
#define SAMPLE_INTERVAL_MS 500  // ms between samples

// ─────────────────────────────────────────
//  DATA STRUCT
// ─────────────────────────────────────────
struct SensorSample {
  unsigned long timestamp;
  int   temp;
  int   hum;
  bool  dht_ok;
  float ax, ay, az;
  float flow;
};

SensorSample sampleBuffer[BUFFER_SIZE];
uint8_t bufferIndex = 0;
uint8_t bufferCount = 0;

// ─────────────────────────────────────────
//  SENSORS
// ─────────────────────────────────────────
DHT11            dht11(18);
Adafruit_MPU6050 mpu;

#define FLOW_PIN 33
volatile uint32_t pulseCount = 0;
float             flowRate   = 0.0f;
unsigned long     lastFlowTime = 0;
const float       PULSES_PER_L = 7.5f;

void IRAM_ATTR pulseCounter() { pulseCount++; }

// last valid DHT11 reading (avoids publishing 0 on transient errors)
int lastTemp = 0, lastHum = 0;

// ─────────────────────────────────────────
//  MQTT
// ─────────────────────────────────────────
WiFiClient   espClient;
PubSubClient mqtt(espClient);

void connectWiFi() {
  LOG_INFO("Connecting to WiFi: %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println();
  LOG_INFO("WiFi connected — IP: %s", WiFi.localIP().toString().c_str());
}

void connectMQTT() {
  char clientId[32];
  snprintf(clientId, sizeof(clientId), "ESP32_%04X",
           (uint16_t)(ESP.getEfuseMac() & 0xFFFF));

  while (!mqtt.connected()) {
    LOG_INFO("Connecting MQTT as %s ...", clientId);
    if (mqtt.connect(clientId)) {
      LOG_INFO("MQTT connected to %s:%d", MQTT_HOST, MQTT_PORT);
    } else {
      LOG_WARN("MQTT failed rc=%d — retry in 2s", mqtt.state());
      delay(2000);
    }
  }
}

// ─────────────────────────────────────────
//  FLUSH: publish every sample in the buffer
// ─────────────────────────────────────────
void flushBuffer() {
  LOG_INFO("Flushing %d samples to MQTT topic: %s", bufferCount, MQTT_TOPIC);

  for (uint8_t i = 0; i < bufferCount; i++) {
    SensorSample& s = sampleBuffer[i];

    // reconnect if needed before each publish
    if (!mqtt.connected()) connectMQTT();
    mqtt.loop();

    char payload[192];
    snprintf(payload, sizeof(payload),
      "{\"temp\":%d,\"hum\":%d,\"ax\":%.3f,\"ay\":%.3f,\"az\":%.3f,\"flow\":%.2f}",
      s.temp, s.hum, s.ax, s.ay, s.az, s.flow
    );

    if (mqtt.publish(MQTT_TOPIC, payload)) {
      LOG_INFO("[%d/%d] sent: %s", i + 1, bufferCount, payload);
    } else {
      LOG_WARN("[%d/%d] publish failed", i + 1, bufferCount);
    }
  }

  bufferIndex = 0;
  bufferCount = 0;
  LOG_VERBOSE("Buffer cleared");
}

// ─────────────────────────────────────────
//  SETUP
// ─────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  LOG_INFO("=== ESP32 Sensor Node booting ===");

  connectWiFi();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(512);
  connectMQTT();

  Wire.begin(21, 22);
  if (!mpu.begin()) {
    LOG_ERROR("MPU6050 not found — check wiring");
    while (1) delay(500);
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_2_G);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  LOG_INFO("MPU6050 OK");

  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), pulseCounter, FALLING);
  lastFlowTime = millis();
  LOG_INFO("Flow sensor on GPIO%d", FLOW_PIN);

  LOG_INFO("Ready — buffer: %d samples @ %dms each", BUFFER_SIZE, SAMPLE_INTERVAL_MS);
  LOG_INFO("=================================\n");
}

// ─────────────────────────────────────────
//  LOOP
// ─────────────────────────────────────────
void loop() {
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();

  unsigned long now = millis();

  // ── Flow (update every 1 s) ──
  if (now - lastFlowTime >= 1000) {
    noInterrupts();
    uint32_t captured = pulseCount;
    pulseCount = 0;
    interrupts();
    float elapsed = (now - lastFlowTime) / 1000.0f;
    flowRate = (captured / PULSES_PER_L) * (60.0f / elapsed);
    lastFlowTime = now;
    LOG_VERBOSE("Flow: %d pulses → %.2f L/min", captured, flowRate);
  }

  // ── DHT11 ──
  int t = 0, h = 0;
  bool dht_ok = (dht11.readTemperatureHumidity(t, h) == 0);
  if (dht_ok) { lastTemp = t; lastHum = h; }
  else         { LOG_WARN("DHT11 read failed — using last valid"); }

  // ── MPU6050 ──
  sensors_event_t a, g, tmp;
  mpu.getEvent(&a, &g, &tmp);
  LOG_VERBOSE("Accel: X=%.3f Y=%.3f Z=%.3f", a.acceleration.x, a.acceleration.y, a.acceleration.z);

  // ── Store in buffer ──
  SensorSample& slot = sampleBuffer[bufferIndex];
  slot.timestamp = now;
  slot.temp      = lastTemp;
  slot.hum       = lastHum;
  slot.dht_ok    = dht_ok;
  slot.ax        = a.acceleration.x;
  slot.ay        = a.acceleration.y;
  slot.az        = a.acceleration.z;
  slot.flow      = flowRate;
  bufferIndex++;
  bufferCount++;
  LOG_VERBOSE("Stored sample %d/%d", bufferCount, BUFFER_SIZE);

  // ── Flush when full ──
  if (bufferCount >= BUFFER_SIZE) {
    flushBuffer();
  }

  delay(SAMPLE_INTERVAL_MS);
}
