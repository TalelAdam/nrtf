import { Controller, Get, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { WhrService } from './whr.service';
import { WhrParamsDto } from './dto/whr-params.dto';

@Controller('whr')
export class WhrController {
  constructor(private readonly whrService: WhrService) {}

  /**
   * GET /whr/calculate
   * Returns full WHR computation for the given user parameters.
   * All query params are optional; missing ones fall back to audit-calibrated defaults.
   */
  @Get('calculate')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  calculate(@Query() dto: WhrParamsDto) {
    return this.whrService.calculate(dto);
  }

  /**
   * GET /whr/scenarios
   * Returns the three scored scenarios side-by-side for dashboard cards.
   */
  @Get('scenarios')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  scenarios(@Query() dto: WhrParamsDto) {
    return this.whrService.scenarios(dto);
  }

  /**
   * GET /whr/defaults
   * Returns the audit-calibrated default parameter values for the sidebar sliders.
   */
  @Get('defaults')
  defaults() {
    return this.whrService.defaults();
  }
}
