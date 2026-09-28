import { ApiProperty } from '@nestjs/swagger';

export class VertexResponseDto {
  @ApiProperty()
  sequence!: number;

  @ApiProperty()
  latitude!: number;

  @ApiProperty()
  longitude!: number;
}

export class PolygonResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: [VertexResponseDto] })
  vertices!: VertexResponseDto[];
}

export class OfficeResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ required: false })
  address?: string | null;

  @ApiProperty({ required: false })
  city?: string | null;

  @ApiProperty({ required: false })
  country?: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ required: false, type: PolygonResponseDto })
  activePolygon?: PolygonResponseDto | null;
}

export class VerifyLocationResponseDto {
  @ApiProperty({ description: 'Whether the coordinates are inside the office polygon' })
  isInside!: boolean;

  @ApiProperty({ description: 'Target office identifier' })
  officeId!: string;

  @ApiProperty({ description: 'Office name' })
  officeName!: string;

  @ApiProperty({ description: 'Distance in meters to the nearest polygon edge' })
  distanceToBoundaryMeters!: number;

  @ApiProperty({ description: 'Whether altitude check passed (if altitude bounds configured)' })
  altitudeValid!: boolean;
}
