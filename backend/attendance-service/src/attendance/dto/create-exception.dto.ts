import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export enum ExceptionType {
  RECHECK_IN = 'RECHECK_IN',
  EXTRA_GRACE = 'EXTRA_GRACE',
  OFFICE_TRANSFER = 'OFFICE_TRANSFER',
  WORKING_TIME_ADJUSTMENT = 'WORKING_TIME_ADJUSTMENT',
}

export class CreateExceptionDto {
  @ApiProperty({ description: 'Employee ID for whom exception is requested', example: 'EMP-001' })
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @ApiProperty({ description: 'Date of attendance (YYYY-MM-DD)', example: '2026-09-25' })
  @IsDateString()
  attendanceDate!: string;

  @ApiProperty({ enum: ExceptionType, example: ExceptionType.RECHECK_IN })
  @IsEnum(ExceptionType)
  type!: ExceptionType;

  @ApiProperty({ description: 'Reason for exception request', example: 'Site visit concluded, returned to office' })
  @IsString()
  @MaxLength(255)
  reason!: string;

  @ApiPropertyOptional({ description: 'Specific session ID if applicable' })
  @IsOptional()
  @IsString()
  attendanceSessionId?: string;

  @ApiPropertyOptional({ description: 'Additional working hours requested (e.g. 2)', example: 2 })
  @IsOptional()
  additionalHours?: number;

  @ApiPropertyOptional({ description: 'Additional working minutes requested (e.g. 120)', example: 120 })
  @IsOptional()
  additionalMinutes?: number;

  @ApiPropertyOptional({ description: 'Target HR Email' })
  @IsOptional()
  @IsString()
  hrEmail?: string;

  @ApiPropertyOptional({ description: 'Additional metadata JSON' })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Valid from timestamp (ISO-8601)', example: '2026-09-25T13:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ description: 'Valid until timestamp (ISO-8601)', example: '2026-09-25T18:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
