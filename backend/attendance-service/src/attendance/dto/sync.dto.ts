import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AttendanceEventType } from '../enums';
import { LocationDto } from './location.dto';

export class SyncEventDto {
  @ApiProperty({ example: 'uuid-1' })
  @IsUUID()
  clientEventId: string;

  @ApiProperty({ enum: AttendanceEventType })
  @IsEnum(AttendanceEventType)
  eventType: AttendanceEventType;

  @ApiProperty({ example: '2026-09-22T09:30:00Z' })
  @IsDateString()
  eventTime: string;

  @ApiProperty({ example: 'OFFICE-001' })
  @IsString()
  @MinLength(1)
  officeId: string;

  @ApiProperty({ type: LocationDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}

export class SyncDto {
  @ApiProperty({ type: [SyncEventDto] })
  @ValidateNested({ each: true })
  @Type(() => SyncEventDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  events: SyncEventDto[];
}
