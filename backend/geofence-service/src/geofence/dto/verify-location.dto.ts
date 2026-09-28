import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class VerifyLocationDto {
  @ApiProperty({ description: 'Office UUID or Code', example: 'OFFICE-001' })
  @IsString()
  @IsNotEmpty()
  officeId!: string;

  @ApiProperty({ description: 'Current latitude (-90 to 90)', example: 18.5204 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ description: 'Current longitude (-180 to 180)', example: 73.8567 })
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({ description: 'GPS Altitude in meters', example: 560.2 })
  @IsOptional()
  @IsNumber()
  altitudeMeters?: number;

  @ApiPropertyOptional({ description: 'GPS accuracy in meters', example: 10 })
  @IsOptional()
  @IsNumber()
  accuracyMeters?: number;
}
