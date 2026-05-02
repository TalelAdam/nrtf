import { Module } from '@nestjs/common';
import { IoTService } from './iot.service';
import { IoTGateway } from './iot.gateway';
import { IoTController } from './iot.controller';

@Module({
  controllers: [IoTController],
  providers: [IoTService, IoTGateway],
  exports: [IoTService],
})
export class IoTModule {}
