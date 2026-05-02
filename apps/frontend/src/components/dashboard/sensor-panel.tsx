"use client";

import { useIoT } from '@/hooks/use-iot';
import { SensorKpis } from './sensor-kpis';
import { AccelChart } from './accel-chart';

export function SensorPanel() {
  // Initialises Socket.io once and subscribes to the store
  useIoT();

  return (
    <aside className="sensor-panel">
      <SensorKpis />
      <AccelChart />
    </aside>
  );
}
