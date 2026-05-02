import { Module } from '@nestjs/common';
import { IoTService } from './iot.service';
import { IoTGateway } from './iot.gateway';

@Module({
  providers: [IoTService, IoTGateway],
  exports: [IoTService],
})
export class IoTModule {}
