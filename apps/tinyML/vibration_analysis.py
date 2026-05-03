"""
vibration_analysis.py
──────────────────────────────────────────────────────────────────
Visualizes vibration data and extracts the key ML features:

  Tier 1 (Most impactful):
    • RMS per axis
    • Kurtosis per axis
    • Crest Factor per axis
    • FFT dominant peaks + amplitudes
    • Spectral centroid per axis
    • Band energy (0–50 / 50–150 / 150–250 Hz)

  Tier 2 (Complement):
    • Variance, Std Dev
    • Skewness
    • Zero Crossing Rate

Usage:
    python vibration_analysis.py                       # uses vibration.csv
    python vibration_analysis.py path/to/my_file.csv  # custom file
"""

import sys
import os
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from scipy.stats import kurtosis, skew
from scipy.signal import find_peaks

# ── Config ────────────────────────────────────────────────────
FS          = 500                        # Sampling frequency (Hz)
FREQ_MAX    = 200                        # Max freq to display in FFT plots
BANDS       = [(0, 50), (50, 150), (150, 250)]   # Energy bands (Hz)
BAND_LABELS = ["0–50 Hz", "50–150 Hz", "150–250 Hz"]
AXES        = ["ax", "ay", "az"]
COLORS      = ["#E63946", "#2A9D8F", "#E9C46A"]  # red, teal, gold
# ─────────────────────────────────────────────────────────────


# ── Helpers ───────────────────────────────────────────────────

def load_csv(filepath: str) -> np.ndarray:
    """Load CSV, skip header and comment lines."""
    data = []
    with open(filepath, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or line.lower().startswith("time"):
                continue
            parts = line.split(",")
            if len(parts) == 4:
                try:
                    data.append([float(p) for p in parts])
                except ValueError:
                    continue
    return np.array(data)


def remove_dc(signal: np.ndarray) -> np.ndarray:
    """Remove DC offset (gravity component)."""
    return signal - np.mean(signal)


def compute_fft(signal: np.ndarray, fs: int):
    """Return (frequencies, amplitudes) for positive half of FFT."""
    N      = len(signal)
    window = np.hanning(N)
    sig_w  = signal * window
    fft_v  = 2 * np.abs(np.fft.fft(sig_w)) / N
    freqs  = np.fft.fftfreq(N, 1 / fs)
    mask   = freqs >= 0
    return freqs[mask], fft_v[mask]


def band_energy(freqs: np.ndarray, fft_v: np.ndarray, f_low: float, f_high: float) -> float:
    mask = (freqs >= f_low) & (freqs < f_high)
    return float(np.sum(fft_v[mask] ** 2))


def zero_crossing_rate(signal: np.ndarray) -> float:
    return float(np.sum(np.diff(np.sign(signal)) != 0)) / len(signal)


def extract_features(signal: np.ndarray, fs: int, axis_name: str) -> dict:
    s = remove_dc(signal)
    freqs, fft_v = compute_fft(s, fs)

    rms         = float(np.sqrt(np.mean(s ** 2)))
    peak_val    = float(np.max(np.abs(s)))
    crest       = peak_val / rms if rms > 0 else 0.0
    kurt        = float(kurtosis(s))
    skewness    = float(skew(s))
    std         = float(np.std(s))
    variance    = float(np.var(s))
    zcr         = zero_crossing_rate(s)

    # Spectral centroid
    centroid = (
        float(np.sum(freqs * fft_v) / np.sum(fft_v))
        if np.sum(fft_v) > 0 else 0.0
    )

    # Dominant peak
    peaks, props = find_peaks(fft_v, height=0.001, distance=5)
    if len(peaks):
        top_idx       = peaks[np.argmax(props["peak_heights"])]
        peak_freq     = float(freqs[top_idx])
        peak_amp      = float(fft_v[top_idx])
    else:
        peak_freq = peak_amp = 0.0

    # Band energies
    bands_e = {
        lbl: band_energy(freqs, fft_v, lo, hi)
        for (lo, hi), lbl in zip(BANDS, BAND_LABELS)
    }

    return {
        "axis"          : axis_name,
        "RMS"           : rms,
        "Peak Value"    : peak_val,
        "Crest Factor"  : crest,
        "Kurtosis"      : kurt,
        "Skewness"      : skewness,
        "Std Dev"       : std,
        "Variance"      : variance,
        "Zero Cross Rate": zcr,
        "Spectral Centroid (Hz)": centroid,
        "Dominant Freq (Hz)"    : peak_freq,
        "Dominant Amp"          : peak_amp,
        **bands_e,
    }


# ── Plotting ──────────────────────────────────────────────────

def plot_all(data: np.ndarray, features: list[dict]):
    t  = data[:, 0] / 1000.0          # ms → seconds
    ax = remove_dc(data[:, 1])
    ay = remove_dc(data[:, 2])
    az = remove_dc(data[:, 3])
    signals = [ax, ay, az]

    fig = plt.figure(figsize=(18, 17))
    fig.patch.set_facecolor("#0D1117")
    gs = gridspec.GridSpec(4, 3, figure=fig, hspace=0.9, wspace=0.45)
    # ── Row 0: Time-domain (all 3 axes) ──
    for col, (sig, lbl, clr) in enumerate(zip(signals, AXES, COLORS)):
        ax_plot = fig.add_subplot(gs[0, col])
        ax_plot.plot(t, sig, color=clr, linewidth=0.7)
        ax_plot.set_facecolor("#161B22")
        ax_plot.set_title(f"Time Domain — {lbl}", color="white", fontsize=10)
        ax_plot.set_xlabel("Time (s)", color="#8B949E")
        ax_plot.set_ylabel("Accel (g)", color="#8B949E")
        ax_plot.tick_params(colors="#8B949E")
        for spine in ax_plot.spines.values():
            spine.set_edgecolor("#30363D")
        ax_plot.grid(color="#21262D", linewidth=0.5)

    # ── Row 1: FFT (all 3 axes) ──
    for col, (sig, lbl, clr) in enumerate(zip(signals, AXES, COLORS)):
        freqs, fft_v = compute_fft(sig, FS)
        mask = freqs <= FREQ_MAX
        ax_plot = fig.add_subplot(gs[1, col])
        ax_plot.fill_between(freqs[mask], fft_v[mask], alpha=0.3, color=clr)
        ax_plot.plot(freqs[mask], fft_v[mask], color=clr, linewidth=1.0)

        # Mark dominant peak
        f = features[col]
        if f["Dominant Freq (Hz)"] > 0:
            ax_plot.axvline(f["Dominant Freq (Hz)"], color="white",
                            linestyle="--", linewidth=0.8, alpha=0.7)
            ax_plot.text(f["Dominant Freq (Hz)"] + 1, f["Dominant Amp"] * 0.9,
                         f"{f['Dominant Freq (Hz)']:.1f} Hz",
                         color="white", fontsize=7)

        ax_plot.set_facecolor("#161B22")
        ax_plot.set_title(f"FFT — {lbl}", color="white", fontsize=10)
        ax_plot.set_xlabel("Frequency (Hz)", color="#8B949E")
        ax_plot.set_ylabel("Amplitude", color="#8B949E")
        ax_plot.tick_params(colors="#8B949E")
        for spine in ax_plot.spines.values():
            spine.set_edgecolor("#30363D")
        ax_plot.grid(color="#21262D", linewidth=0.5)

    # ── Row 2: Band Energy bar chart per axis ──
    for col, (f, lbl, clr) in enumerate(zip(features, AXES, COLORS)):
        energies = [f[bl] for bl in BAND_LABELS]
        ax_plot  = fig.add_subplot(gs[2, col])
        alphas = [1.0, 0.7, 0.4]
        bars = ax_plot.bar(BAND_LABELS, energies,
                   color=clr, edgecolor="#30363D")
        for bar, a in zip(bars, alphas):
            bar.set_alpha(a)
        ax_plot.set_facecolor("#161B22")
        ax_plot.set_title(f"Band Energy — {lbl}", color="white", fontsize=10)
        ax_plot.set_ylabel("Energy", color="#8B949E")
        ax_plot.tick_params(colors="#8B949E", labelsize=7)
        ax_plot.tick_params(axis="x", labelrotation=15)
        for spine in ax_plot.spines.values():
            spine.set_edgecolor("#30363D")
        ax_plot.grid(axis="y", color="#21262D", linewidth=0.5)

    # ── Row 3: Feature summary table ──
    ax_table = fig.add_subplot(gs[3, :])
    ax_table.set_facecolor("#161B22")
    ax_table.axis("off")

    TABLE_KEYS = [
        "RMS", "Peak Value", "Crest Factor", "Kurtosis",
        "Skewness", "Spectral Centroid (Hz)", "Dominant Freq (Hz)",
        "Zero Cross Rate",
    ]
    col_labels = ["Feature"] + AXES
    rows = []
    for key in TABLE_KEYS:
        row = [key]
        for f in features:
            val = f.get(key, 0.0)
            # Color-code kurtosis > 3 (fault indicator)
            row.append(f"{val:.4f}")
        rows.append(row)

    tbl = ax_table.table(
        cellText   = rows,
        colLabels  = col_labels,
        loc        = "center",
        cellLoc    = "center",
    )
    tbl.auto_set_font_size(False)
    tbl.set_fontsize(9)
    tbl.scale(1, 1.5)

    for (r, c), cell in tbl.get_celld().items():
        cell.set_facecolor("#0D1117" if r == 0 else "#161B22")
        cell.set_text_props(color="white")
        cell.set_edgecolor("#30363D")
        # Highlight kurtosis > 3 in red
        if r > 0 and rows[r - 1][0] == "Kurtosis" and c > 0:
            try:
                if float(rows[r - 1][c]) > 3.0:
                    cell.set_facecolor("#3D1A1A")
            except ValueError:
                pass

    ax_table.set_title(
        "Feature Summary (Kurtosis > 3 → possible fault)",
        color="white", fontsize=10, pad=8
    )

    fig.suptitle(
        "Vibration Analysis — RMS · Kurtosis · FFT · Band Energy",
        color="white", fontsize=13, fontweight="bold", y=0.98
    )
    plt.show()


# ── Console feature report ─────────────────────────────────────

def print_feature_report(features: list[dict]):
    sep = "─" * 60
    print(f"\n{sep}")
    print("  VIBRATION FEATURE REPORT")
    print(sep)
    for f in features:
        print(f"\n  Axis: {f['axis'].upper()}")
        print(f"    RMS              : {f['RMS']:.5f} g")
        print(f"    Peak Value       : {f['Peak Value']:.5f} g")
        print(f"    Crest Factor     : {f['Crest Factor']:.3f}  {'⚠ HIGH' if f['Crest Factor'] > 6 else ''}")
        print(f"    Kurtosis         : {f['Kurtosis']:.4f}  {'⚠ FAULT INDICATOR' if f['Kurtosis'] > 3 else '✓ Normal'}")
        print(f"    Skewness         : {f['Skewness']:.4f}")
        print(f"    Std Dev          : {f['Std Dev']:.5f}")
        print(f"    Zero Cross Rate  : {f['Zero Cross Rate']:.4f}")
        print(f"    Spectral Centroid: {f['Spectral Centroid (Hz)']:.2f} Hz")
        print(f"    Dominant Freq    : {f['Dominant Freq (Hz)']:.2f} Hz  (amp: {f['Dominant Amp']:.5f})")
        for lbl in BAND_LABELS:
            print(f"    Band [{lbl}]: {f[lbl]:.6f}")
    print(f"\n{sep}\n")


# ── Main ──────────────────────────────────────────────────────

def main():
    filepath = sys.argv[1] if len(sys.argv) > 1 else "vibration.csv"

    if not os.path.exists(filepath):
        print(f"[ERROR] File not found: {filepath}")
        print("  Usage: python vibration_analysis.py [path/to/file.csv]")
        sys.exit(1)

    print(f"[INFO] Loading: {filepath}")
    data = load_csv(filepath)

    if len(data) < 10:
        print("[ERROR] Not enough rows in CSV (need at least 10)")
        sys.exit(1)

    print(f"[INFO] Loaded {len(data)} samples ({len(data)/FS:.2f} seconds @ {FS} Hz)\n")

    # Extract features for all 3 axes
    features = [
        extract_features(data[:, i + 1], FS, lbl)
        for i, lbl in enumerate(AXES)
    ]

    print_feature_report(features)
    plot_all(data, features)


if __name__ == "__main__":
    main()
