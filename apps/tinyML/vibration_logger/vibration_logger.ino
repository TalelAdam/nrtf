/*
 * Vibration Data Logger for Edge Impulse
 * MPU6050 via ESP32 — All 3 axes at ~500 Hz
 *
 * Wiring:
 *   SDA -> GPIO 21
 *   SCL -> GPIO 22
 *   VCC -> 3.3V
 *   GND -> GND
 *
 * Output CSV: timestamp_ms, ax, ay, az
 */

#include <Wire.h>
#include <MPU6050_tockn.h>

MPU6050 mpu(Wire);

// ── Sampling config ──────────────────────────────────────────
const int   SAMPLE_INTERVAL_MS = 2;      // 2 ms = 500 Hz
const int   WINDOW_SAMPLES     = 500;    // 1-second window (printed to Serial)
const float ACCEL_SCALE        = 1.0;    // Keep in g units (EI expects g)

// ── State ─────────────────────────────────────────────────────
unsigned long lastSample = 0;
int sampleCount = 0;

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  Wire.setClock(400000);  // 400 kHz I2C for faster reads

  mpu.begin();

  // Gyro offset calibration — keep the sensor STILL during startup
  Serial.println("# Calibrating gyro offsets — keep sensor still...");
  mpu.calcGyroOffsets(true);
  Serial.println("# Calibration done.");

  // CSV header — Edge Impulse data forwarder expects no header,
  // but the Python logger will strip '#' lines automatically.
  Serial.println("# timestamp_ms,ax,ay,az");
  Serial.println("# FORMAT: millis, accel_x(g), accel_y(g), accel_z(g)");
  Serial.println("# READY");

  delay(100);
}

void loop() {
  unsigned long now = millis();

  if (now - lastSample >= SAMPLE_INTERVAL_MS) {
    lastSample = now;
    mpu.update();

    float ax = mpu.getAccX() * ACCEL_SCALE;
    float ay = mpu.getAccY() * ACCEL_SCALE;
    float az = mpu.getAccZ() * ACCEL_SCALE;

    // Compact format: pure CSV, no spaces
    Serial.print(now);
    Serial.print(",");
    Serial.print(ax, 5);
    Serial.print(",");
    Serial.print(ay, 5);
    Serial.print(",");
    Serial.println(az, 5);

    sampleCount++;

    // Every WINDOW_SAMPLES print a marker so Python can auto-segment
    if (sampleCount >= WINDOW_SAMPLES) {
      Serial.println("# WINDOW_END");
      sampleCount = 0;
    }
  }
}
