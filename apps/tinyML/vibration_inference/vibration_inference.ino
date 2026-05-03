/* Edge Impulse Inference — Modified for MPU6050
 * Original: EdgeImpulse Inc.
 * Modified: MPU6050 via MPU6050_tockn library
 *
 * Wiring:
 *   SDA -> GPIO 21
 *   SCL -> GPIO 22
 *   VCC -> 3.3V
 *   GND -> GND
 */

/* Includes ---------------------------------------------------------------- */
#include <Vibration_ML_inferencing.h>   // ← your project's library
#include <Wire.h>
#include <MPU6050_tockn.h>

/* Constant defines -------------------------------------------------------- */
#define CONVERT_G_TO_MS2    9.80665f
#define MAX_ACCEPTED_RANGE  2.0f

/* Private variables ------------------------------------------------------- */
static const bool debug_nn = false;
MPU6050 mpu(Wire);

static float ax, ay, az;

/* Forward declarations ---------------------------------------------------- */
bool    init_IMU(void);
uint8_t poll_IMU(void);

/* Sensor struct ----------------------------------------------------------- */
typedef struct {
    const char *name;
    float      *value;
    uint8_t    (*poll_sensor)(void);
    bool       (*init_sensor)(void);
    int8_t     status;
} eiSensors;

#define N_SENSORS 3

static int8_t fusion_sensors[N_SENSORS];
static int    fusion_ix = 0;

eiSensors sensors[] = {
    { "ax", &ax, &poll_IMU, &init_IMU, -1 },
    { "ay", &ay, &poll_IMU, &init_IMU, -1 },
    { "az", &az, &poll_IMU, &init_IMU, -1 },
};

/* Forward declarations for fusion helpers --------------------------------- */
static bool    ei_connect_fusion_list(const char *input_list);
static int8_t  ei_find_axis(char *axis_name);
float          ei_get_sign(float number);

/* ========================================================================= */
void setup()
{
    Serial.begin(115200);
    while (!Serial);
    Serial.println("Edge Impulse MPU6050 Vibration Inference\r\n");

    Wire.begin(21, 22);
    Wire.setClock(400000);

    // Connect axes listed in the model
    if (ei_connect_fusion_list(EI_CLASSIFIER_FUSION_AXES_STRING) == false) {
        ei_printf("ERR: Errors in sensor list\r\n");
        return;
    }

    // Initialize sensors
    for (int i = 0; i < fusion_ix; i++) {
        if (sensors[fusion_sensors[i]].status == 0) {
            sensors[fusion_sensors[i]].status =
                sensors[fusion_sensors[i]].init_sensor() ? 1 : -1;

            if (sensors[fusion_sensors[i]].status == 1)
                ei_printf("%s initialized OK\r\n", sensors[fusion_sensors[i]].name);
            else
                ei_printf("%s initialization FAILED\r\n", sensors[fusion_sensors[i]].name);
        }
    }
}

/* ========================================================================= */
void loop()
{
    ei_printf("\nSampling window...\r\n");

    if (EI_CLASSIFIER_RAW_SAMPLES_PER_FRAME != fusion_ix) {
        ei_printf("ERR: Sensor axes don't match model (%s)\r\n",
                  EI_CLASSIFIER_FUSION_AXES_STRING);
        return;
    }

    // Fill sample buffer
    float buffer[EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE] = { 0 };

    for (size_t ix = 0; ix < EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE;
         ix += EI_CLASSIFIER_RAW_SAMPLES_PER_FRAME)
    {
        int64_t next_tick = (int64_t)micros() +
                            ((int64_t)EI_CLASSIFIER_INTERVAL_MS * 1000);

        for (int i = 0; i < fusion_ix; i++) {
            if (sensors[fusion_sensors[i]].status == 1) {
                sensors[fusion_sensors[i]].poll_sensor();
                sensors[fusion_sensors[i]].status = 2;
            }
            if (sensors[fusion_sensors[i]].status == 2) {
                buffer[ix + i] = *sensors[fusion_sensors[i]].value;
                sensors[fusion_sensors[i]].status = 1;
            }
        }

        int64_t wait_time = next_tick - (int64_t)micros();
        if (wait_time > 0) delayMicroseconds(wait_time);
    }

    // Run inference
    signal_t signal;
    int err = numpy::signal_from_buffer(buffer,
                  EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE, &signal);
    if (err != 0) {
        ei_printf("ERR signal_from_buffer: %d\r\n", err);
        return;
    }

    ei_impulse_result_t result = { 0 };
    err = run_classifier(&signal, &result, debug_nn);
    if (err != EI_IMPULSE_OK) {  
        ei_printf("ERR run_classifier: %d\r\n", err);
        return;
    }

    // ── Print results ──────────────────────────────────────────
    ei_printf("──────────────────────────────\r\n");
    ei_printf("DSP: %dms  |  Inference: %dms\r\n",
              result.timing.dsp, result.timing.classification);

    float best_val   = 0;
    const char *best_label = "";

    for (size_t ix = 0; ix < EI_CLASSIFIER_LABEL_COUNT; ix++) {
        float val = result.classification[ix].value;
        ei_printf("  %-10s : %.4f\r\n",
                  result.classification[ix].label, val);
        if (val > best_val) {
            best_val   = val;
            best_label = result.classification[ix].label;
        }
    }

    // ── Human-readable verdict ─────────────────────────────────
    ei_printf("──────────────────────────────\r\n");
    if (best_val > 0.65f) {
        ei_printf(">> RESULT: %s (%.1f%%)\r\n", best_label, best_val * 100);
    } else {
        ei_printf(">> RESULT: UNCERTAIN (%.1f%%)\r\n", best_val * 100);
    }
    ei_printf("──────────────────────────────\r\n");

#if EI_CLASSIFIER_HAS_ANOMALY == 1
    ei_printf("Anomaly score: %.3f\r\n", result.anomaly);
#endif
}

/* ========================================================================= */
/*  MPU6050 sensor functions                                                  */
/* ========================================================================= */

bool init_IMU(void) {
    static bool initialized = false;
    if (!initialized) {
        mpu.begin();
        Serial.println("Calibrating MPU6050 — keep sensor still...");
        mpu.calcGyroOffsets(true);
        Serial.println("MPU6050 ready.");
        initialized = true;
    }
    return true;
}

uint8_t poll_IMU(void) {
    mpu.update();

    ax = mpu.getAccX();
    ay = mpu.getAccY();
    az = mpu.getAccZ();

    // Clamp to accepted range
    float *vals[3] = { &ax, &ay, &az };
    for (int i = 0; i < 3; i++) {
        if (fabs(*vals[i]) > MAX_ACCEPTED_RANGE)
            *vals[i] = ei_get_sign(*vals[i]) * MAX_ACCEPTED_RANGE;
    }

    // Convert g → m/s²
    ax *= CONVERT_G_TO_MS2;
    ay *= CONVERT_G_TO_MS2;
    az *= CONVERT_G_TO_MS2;

    return 0;
}

/* ========================================================================= */
/*  Fusion helpers (unchanged logic from original)                            */
/* ========================================================================= */

float ei_get_sign(float number) {
    return (number >= 0.0) ? 1.0 : -1.0;
}

static int8_t ei_find_axis(char *axis_name) {
    for (int ix = 0; ix < N_SENSORS; ix++) {
        if (strstr(axis_name, sensors[ix].name))
            return ix;
    }
    return -1;
}

static bool ei_connect_fusion_list(const char *input_list) {
    char *buff;
    bool is_fusion = false;

    char *input_string = (char *)ei_malloc(strlen(input_list) + 1);
    if (!input_string) return false;
    memset(input_string, 0, strlen(input_list) + 1);
    strncpy(input_string, input_list, strlen(input_list));

    memset(fusion_sensors, 0, N_SENSORS);
    fusion_ix = 0;

    buff = strtok(input_string, "+");
    while (buff != NULL) {
        int8_t found_axis = ei_find_axis(buff);
        is_fusion = false;
        if (found_axis >= 0) {
            if (fusion_ix < N_SENSORS) {
                fusion_sensors[fusion_ix++] = found_axis;
                sensors[found_axis].status  = 0;
            }
            is_fusion = true;
        }
        buff = strtok(NULL, "+ ");
    }

    ei_free(input_string);
    return is_fusion;
}
