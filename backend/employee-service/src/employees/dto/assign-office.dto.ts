import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignOfficeDto {
  @ApiProperty({ description: 'Office UUID or code (from Geofence Service)', example: 'OFFICE-001' })
  @IsString()
  @IsNotEmpty()
  officeId!: string;

  @ApiPropertyOptional({ description: 'Whether this is the primary office', default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ description: 'Assignment start date (ISO-8601)' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ description: 'Assignment end date (ISO-8601)' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
