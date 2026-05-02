import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { Esp32Reading } from './iot.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/iot',
  transports: ['websocket', 'polling'],
})
export class IoTGateway implements OnGatewayInit {
  private readonly logger = new Logger(IoTGateway.name);

  @WebSocketServer()
  server!: Server;

  afterInit() {
    this.logger.log('IoT WebSocket gateway ready on /iot');
  }

  @OnEvent('iot.reading')
  handleReading(reading: Esp32Reading) {
    this.logger.log(`Emitting sensor:update → ${JSON.stringify(reading)}`);
    this.server.emit('sensor:update', reading);
  }
}
