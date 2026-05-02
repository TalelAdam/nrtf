/**
 * Socket.io client for the /iot namespace.
 * Receives `sensor:update` events from the NestJS backend which itself
 * subscribes to the MQTT broker and forwards ESP32 readings.
 */

import { io, type Socket } from 'socket.io-client';
import { useIoTStore, type Esp32Reading } from '@/store/iot-store';

let socket: Socket | null = null;

// Backend is always exposed on port 3000 (locally or via Docker port-mapping)
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? 'http://localhost:3000';

export function initIoTSocket() {
  if (typeof window === 'undefined') return; // SSR guard
  if (socket?.connected) return;

  const { setConnectionStatus, pushReading } = useIoTStore.getState();
  setConnectionStatus('connecting');

  socket = io(`${BACKEND_URL}/iot`, {
    transports: ['websocket', 'polling'],
    reconnectionDelay: 3000,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect', () => {
    setConnectionStatus('connected');
  });

  socket.on('disconnect', () => {
    setConnectionStatus('disconnected');
  });

  socket.on('connect_error', () => {
    setConnectionStatus('disconnected');
  });

  socket.on('sensor:update', (reading: Esp32Reading) => {
    pushReading(reading);
  });
}

export function disconnectIoTSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    useIoTStore.getState().reset();
  }
}
