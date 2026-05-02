import { create } from 'zustand';

/** Mirrors the ESP32 JSON payload + server timestamp */
export interface Esp32Reading {
  temp: number;   // °C  — DHT11
  hum: number;    // %   — DHT11
  ax: number;     // m/s² — MPU6050
  ay: number;     // m/s² — MPU6050
  az: number;     // m/s² — MPU6050
  flow: number;   // L/min — YF-S201
  ts: number;     // unix ms (added by backend)
}

const HISTORY_SIZE = 60; // rolling 60-second window

interface IoTState {
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  latest: Esp32Reading | null;
  history: Esp32Reading[]; // newest at end
  tempAlert: boolean;

  setConnectionStatus: (status: IoTState['connectionStatus']) => void;
  pushReading: (r: Esp32Reading) => void;
  setTempAlert: (v: boolean) => void;
  reset: () => void;
}

export const useIoTStore = create<IoTState>((set) => ({
  connectionStatus: 'disconnected',
  latest: null,
  history: [],
  tempAlert: false,

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  pushReading: (r) =>
    set((state) => ({
      latest: r,
      history: [...state.history.slice(-(HISTORY_SIZE - 1)), r],
    })),

  setTempAlert: (v) => set({ tempAlert: v }),

  reset: () =>
    set({ connectionStatus: 'disconnected', latest: null, history: [], tempAlert: false }),
}));
