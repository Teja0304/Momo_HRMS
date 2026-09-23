import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';
import { LocationDto } from './location.dto';

/**
 * The spec's check-out flow doesn't require a location for the business
 * decision (it just closes the existing session) — officeId/location
 * are accepted optionally for the audit event, but clientEventId is
 * always required for idempotency.
 */
export class CheckOutDto {
  @ApiProperty({ required: false, example: 'OFFICE-001' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  officeId?: string;

  @ApiProperty({ required: false, type: LocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiProperty({ example: 'a5b9c1e0-1234-4a1b-9abc-000000000002' })
  @IsUUID()
  clientEventId: string;
}
