import { IsOptional, IsString, IsBase64 } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Used when sending a bill via JSON body (base64-encoded file) */
export class ExtractBillDto {
  @ApiProperty({
    description: 'Base64-encoded file content (PDF or JPEG)',
    required: false,
  })
  @IsOptional()
  @IsBase64()
  base64?: string;

  @ApiProperty({ description: 'Original filename including extension', required: false })
  @IsOptional()
  @IsString()
  filename?: string;
}

/** Used when submitting a single normalised record to the platform */
export class SubmitPayloadDto {
  @ApiProperty({ enum: ['bill', 'excel', 'audit'], description: 'Document type' })
  @IsString()
  type!: 'bill' | 'excel' | 'audit';

  @ApiProperty({ description: 'Extracted record to submit' })
  data!: unknown;
}
