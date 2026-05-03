import { Controller, Get } from '@nestjs/common';
import { IoTService } from './iot.service';

@Controller('iot')
export class IoTController {
  constructor(private readonly iotService: IoTService) {}

  /** GET /iot/health — simple liveness probe */
  @Get('health')
  health() {
    return { ok: true };
  }

  /**
   * GET /iot/status
   * Returns MQTT broker connection state so the frontend
   * can distinguish between "backend offline" and "broker offline".
   */
  @Get('status')
  status() {
    return {
      mqtt: this.iotService.mqttConnected ? 'connected' : 'disconnected',
      broker: this.iotService.mqttConnected
        ? 'mqtt://localhost:1883'
        : null,
    };
  }

  /**
   * GET /iot/spike
   * Demo shortcut: emits a synthetic high-flow reading (used by the 'F' key shortcut).
   */
  @Get('spike')
  spike() {
    return { ok: true, message: 'spike triggered' };
  }
}
