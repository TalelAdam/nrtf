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

  /**
   * GET /whr/analytics
   * Full WHR framework payload — integrates all 8 sections of the Engineering
   * Report v2.0 (NRTF Hackathon 2024–2025, Track B Part 3):
   *   §1  8 heat sources (W1–W8) + tri-gen gap alert
   *   §2  5 equations (EQ-1 to EQ-5) with formulas, variables, limits
   *   §3  Parameter traceability (source · reliability · sensitivity)
   *   §4  MCDA scoring framework (weights · scales · live ranking · sensitivity)
   *   §5  3 scenarios with ROI brackets (best / base / conservative) + 12-yr curves
   *   §6  Data architecture (IoT · Pipeline P2 · user inputs)
   *   §7  7 KPIs with formulas and visualization hints
   *   §8  Mathematical model summary (categories A–D)
   *       Pitch key message
   *
   * All numeric results are recalculated from the supplied query params
   * (same params as /whr/calculate). Static metadata is always included.
   */
  @Get('analytics')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  analytics(@Query() dto: WhrParamsDto) {
    return this.whrService.analytics(dto);
  }
}
