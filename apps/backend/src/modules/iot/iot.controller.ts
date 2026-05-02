import { Controller, Get, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Esp32Reading } from './iot.service';

@Controller('iot')
export class IoTController implements OnModuleInit, OnModuleDestroy {
  private mockTimer: NodeJS.Timeout | null = null;

  // Mock state — slow-drifting values to look realistic
  private t   = 24;    // °C
  private h   = 55;    // %
  private flow = 1.2;  // L/min
  private phase = 0;   // for sinusoidal accel

  constructor(private readonly events: EventEmitter2) {}

  onModuleInit() {
    this.mockTimer = setInterval(() => this.emitMock(), 1000);
  }

  onModuleDestroy() {
    if (this.mockTimer) clearInterval(this.mockTimer);
  }

  private emitMock() {
    this.phase += 0.12;

    // slow random walk within realistic bounds
    this.t    = clamp(this.t    + rand(-0.1, 0.1),  18, 35);
    this.h    = clamp(this.h    + rand(-0.2, 0.2),  30, 80);
    this.flow = clamp(this.flow + rand(-0.05, 0.05), 0, 5);

    const reading: Esp32Reading = {
      temp:  Math.round(this.t),
      hum:   Math.round(this.h),
      ax:    +(Math.sin(this.phase) * 0.4 + rand(-0.05, 0.05)).toFixed(3),
      ay:    +(Math.cos(this.phase) * 0.3 + rand(-0.05, 0.05)).toFixed(3),
      az:    +(9.81 + Math.sin(this.phase * 0.5) * 0.1 + rand(-0.02, 0.02)).toFixed(3),
      flow:  +this.flow.toFixed(2),
      ts:    Date.now(),
    };

    this.events.emit('iot.reading', reading);
  }

  @Get('spike')
  spike() {
    this.flow = 20;
    setTimeout(() => { this.flow = 1.2; }, 5000);
    return { ok: true };
  }

  @Get('test')
  test() {
    this.emitMock();
    return { ok: true };
  }
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}
