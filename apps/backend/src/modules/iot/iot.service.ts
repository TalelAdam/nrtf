import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as mqtt from 'mqtt';

/** Full reading emitted by the ESP32 every second */
export interface Esp32Reading {
  temp: number;   // °C  — DHT11
  hum: number;    // %   — DHT11
  ax: number;     // m/s² — MPU6050
  ay: number;     // m/s² — MPU6050
  az: number;     // m/s² — MPU6050
  flow: number;   // L/min — YF-S201
  ts: number;     // unix ms
}

@Injectable()
export class IoTService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IoTService.name);
  private client: mqtt.MqttClient | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit() {
    const broker = this.config.get<string>('MQTT_BROKER_URL', 'mqtt://test.mosquitto.org');
    const topic  = this.config.get<string>('MQTT_TOPIC', 'esp32/sensors');
    this.logger.log(`Connecting MQTT: ${broker}  topic: ${topic}`);

    this.client = mqtt.connect(broker, {
      clientId: `nrtf-backend-${process.pid}`,
      keepalive: 30,
      reconnectPeriod: 5000,
      connectTimeout: 12000,
    });

    this.client.on('connect', () => {
      this.logger.log('MQTT connected');
      this.client!.subscribe(topic, { qos: 0 }, (err) => {
        if (err) this.logger.warn(`Subscribe error: ${err.message}`);
        else this.logger.log(`Subscribed to ${topic}`);
      });
    });

    this.client.on('message', (_topic: string, payload: Buffer) => {
      this.handleMessage(payload);
    });

    this.client.on('error', (err: Error) => {
      this.logger.warn(`MQTT error: ${err.message}`);
    });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
  }

  private handleMessage(payload: Buffer) {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(payload.toString()) as Record<string, unknown>;
    } catch {
      this.logger.warn('Bad MQTT payload — not JSON');
      return;
    }

    const reading: Esp32Reading = {
      temp:  Number(raw['temp']  ?? 0),
      hum:   Number(raw['hum']   ?? 0),
      ax:    Number(raw['ax']    ?? 0),
      ay:    Number(raw['ay']    ?? 0),
      az:    Number(raw['az']    ?? 0),
      flow:  Number(raw['flow']  ?? 0),
      ts:    Date.now(),
    };

    this.events.emit('iot.reading', reading);
  }
}
