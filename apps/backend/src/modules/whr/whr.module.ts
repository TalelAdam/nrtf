import { Module } from '@nestjs/common';
import { WhrController } from './whr.controller';
import { WhrService } from './whr.service';

@Module({
  controllers: [WhrController],
  providers: [WhrService],
  exports: [WhrService],
})
export class WhrModule {}
