import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DocExtractionModule } from './modules/doc-extraction/doc-extraction.module';
import { WhrModule } from './modules/whr/whr.module';
import { IoTModule } from './modules/iot/iot.module';

@Module({
  imports: [
    // Config — loads .env into process.env globally
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    // Event bus for cross-module notifications
    EventEmitterModule.forRoot({ wildcard: false, delimiter: '.', maxListeners: 20 }),
    // Document intelligence module (Part 2)
    DocExtractionModule,
    // WHR Track B engine (Part 3B)
    WhrModule,
    // IoT MQTT subscriber + WebSocket gateway (Part 1)
    IoTModule,
  ],
})
export class AppModule {}
