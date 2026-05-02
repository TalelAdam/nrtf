"use client";

import { useEffect } from 'react';
import { initIoTSocket, disconnectIoTSocket } from '@/lib/mqtt-client';
import { useIoTStore } from '@/store/iot-store';

/** Initialises the Socket.io connection once on mount and returns the store. */
export function useIoT() {
  useEffect(() => {
    initIoTSocket();
    return () => disconnectIoTSocket();
  }, []);

  return useIoTStore();
}
