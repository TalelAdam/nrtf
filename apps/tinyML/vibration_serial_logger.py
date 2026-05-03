"""
vibration_serial_logger.py
──────────────────────────
Reads ax, ay, az from ESP32 over Serial and saves clean CSV files.

Features:
  - Auto-skips comment lines (lines starting with '#')
  - Validates each line before writing
  - Optional: auto-split into windowed files for Edge Impulse upload
  - Prints live RMS per window so you can monitor signal health

Usage:
  1. Flash vibration_logger.ino to your ESP32
  2. Edit PORT below to match your system
  3. Run:  python vibration_serial_logger.py
  4. Press Ctrl+C to stop — output is in  vibration_data/
"""

import serial
import time
import os
import numpy as np

# ── Config ────────────────────────────────────────────────────
PORT          = "COM16"         # Windows: "COM16" | Linux/Mac: "/dev/ttyUSB0"
BAUD          = 115200
OUTPUT_DIR    = "vibration_data"
SAMPLE_RATE   = 500             # Hz — must match Arduino SAMPLE_INTERVAL_MS
WINDOW_SIZE   = 500             # samples per file (1 second window)
AUTO_SPLIT    = True            # Save separate file per window (good for EI)
LABEL         = "faulty"        # Change to "fault", "imbalance", etc.
# ─────────────────────────────────────────────────────────────


def compute_rms(values: list) -> float:
    arr = np.array(values, dtype=float)
    return float(np.sqrt(np.mean(arr ** 2)))


def is_valid_row(line: str) -> bool:
    """Accept lines with exactly 3 commas and a numeric first field."""
    if line.startswith("#"):
        return False
    parts = line.split(",")
    if len(parts) != 4:
        return False
    try:
        [float(p) for p in parts]
        return True
    except ValueError:
        return False


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    ser = serial.Serial(PORT, BAUD, timeout=2)
    time.sleep(2)   # wait for ESP32 reset

    print(f"[INFO] Connected to {PORT} @ {BAUD} baud")
    print(f"[INFO] Label: '{LABEL}' | Window: {WINDOW_SIZE} samples | Auto-split: {AUTO_SPLIT}")
    print("[INFO] Press Ctrl+C to stop\n")

    window_buffer = []   # rows for current window
    window_index  = 0    # file counter
    total_rows    = 0

    # If not splitting, open a single file
    single_file = None
    if not AUTO_SPLIT:
        filename = os.path.join(OUTPUT_DIR, f"{LABEL}_all.csv")
        single_file = open(filename, "w")
        single_file.write("timestamp_ms,ax,ay,az\n")
        print(f"[INFO] Writing all data to: {filename}")

    try:
        while True:
            raw = ser.readline().decode("utf-8", errors="ignore").strip()

            if not raw:
                continue

            # Print comments/status from ESP32 for debugging
            if raw.startswith("#"):
                print(f"[ESP32] {raw}")
                continue

            if not is_valid_row(raw):
                continue

            parts = raw.split(",")
            row   = f"{parts[0]},{parts[1]},{parts[2]},{parts[3]}\n"

            if AUTO_SPLIT:
                window_buffer.append(row)

                if len(window_buffer) >= WINDOW_SIZE:
                    # Save window to its own file
                    filename = os.path.join(
                        OUTPUT_DIR,
                        f"{LABEL}_{window_index:04d}.csv"
                    )
                    with open(filename, "w") as f:
                        f.write("timestamp_ms,ax,ay,az\n")
                        f.writelines(window_buffer)

                    # Quick health check — print RMS for az
                    az_vals = [float(r.split(",")[3]) for r in window_buffer]
                    rms_az  = compute_rms(az_vals)
                    print(f"[WINDOW {window_index:04d}] Saved {filename}  |  RMS(az) = {rms_az:.5f} g")

                    window_buffer = []
                    window_index += 1
            else:
                single_file.write(row)
                total_rows += 1

                # Print RMS every WINDOW_SIZE rows
                if total_rows % WINDOW_SIZE == 0:
                    print(f"[INFO] {total_rows} rows logged")

    except KeyboardInterrupt:
        print("\n[INFO] Stopped by user.")

    finally:
        # Flush any leftover buffer
        if AUTO_SPLIT and window_buffer:
            filename = os.path.join(OUTPUT_DIR, f"{LABEL}_{window_index:04d}.csv")
            with open(filename, "w") as f:
                f.write("timestamp_ms,ax,ay,az\n")
                f.writelines(window_buffer)
            print(f"[FLUSH] Saved partial window: {filename}")

        if single_file:
            single_file.close()

        ser.close()
        print(f"[INFO] Done. Files saved in: ./{OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
