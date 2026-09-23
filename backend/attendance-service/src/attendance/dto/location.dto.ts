import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class LocationDto {
  @ApiProperty({ example: 18.5204, minimum: -90, maximum: 90 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: 73.8567, minimum: -180, maximum: 180 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({ required: false, example: 560.2, description: 'Additional info only — never the primary geofence check (GPS altitude is unreliable)' })
  @IsOptional()
  @IsNumber()
  altitudeMeters?: number;

  @ApiProperty({ required: false, example: 10, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracyMeters?: number;

  @ApiProperty({ example: '2026-09-22T09:32:10Z' })
  @IsDateString()
  timestamp: string;
}
