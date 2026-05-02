import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class WhrParamsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(130)
  @Max(300)
  t_flue_in?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(110)
  @Max(160)
  t_flue_out_target?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.6)
  @Max(0.9)
  eta_hx?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(0.8)
  eta_r_comp?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(50)
  @Max(200)
  p_gn?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(80)
  @Max(300)
  p_elec?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(200000)
  capex_s1?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  capex_s2?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(400000)
  capex_s3?: number;
}
