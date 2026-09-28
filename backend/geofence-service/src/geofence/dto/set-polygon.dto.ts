import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class VertexDto {
  @ApiProperty({ example: 18.5210 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 73.8560 })
  @IsLongitude()
  longitude!: number;
}

export class SetPolygonDto {
  @ApiPropertyOptional({ description: 'Name of the boundary version', example: 'Building B Perimeter' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Array of at least 3 polygon vertex points',
    type: [VertexDto],
    example: [
      { latitude: 18.5210, longitude: 73.8560 },
      { latitude: 18.5210, longitude: 73.8570 },
      { latitude: 18.5200, longitude: 73.8570 },
      { latitude: 18.5200, longitude: 73.8560 },
    ],
  })
  @IsArray()
  @ArrayMinSize(3)
  @ValidateNested({ each: true })
  @Type(() => VertexDto)
  vertices!: VertexDto[];

  @ApiPropertyOptional({ description: 'Floor/building min altitude in meters' })
  @IsOptional()
  @IsNumber()
  minAltitudeMeters?: number;

  @ApiPropertyOptional({ description: 'Floor/building max altitude in meters' })
  @IsOptional()
  @IsNumber()
  maxAltitudeMeters?: number;
}
