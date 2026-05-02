import { Controller, Get } from '@nestjs/common';

@Controller('iot')
export class IoTController {
  @Get('health')
  health() {
    return { ok: true };
  }
}
