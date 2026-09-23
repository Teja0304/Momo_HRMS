import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';
import { LocationDto } from './location.dto';

export class LocationEventDto {
  @ApiProperty({ example: 'OFFICE-001' })
  @IsString()
  @MinLength(1)
  officeId: string;

  @ApiProperty({ type: LocationDto })
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @ApiProperty({ example: 'a5b9c1e0-1234-4a1b-9abc-000000000001' })
  @IsUUID()
  clientEventId: string;
}
