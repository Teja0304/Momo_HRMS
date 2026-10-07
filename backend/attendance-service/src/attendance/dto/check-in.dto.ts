import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { LocationEventDto } from './location-event.dto';

/**
 * Check-in requires location, geofence validation, and a valid
 * cryptographically signed face verification token from face-ai-service.
 */
export class CheckInDto extends LocationEventDto {
  @ApiProperty({
    description: 'Cryptographically signed face verification token issued by face-ai-service',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty({ message: 'Face biometric verification is mandatory for check-in' })
  faceVerificationToken: string;
}

