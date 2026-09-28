import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GeofenceService } from '../services/geofence.service';
import { VerifyLocationDto } from '../dto/verify-location.dto';
import { VerifyLocationResponseDto } from '../dto/office-response.dto';
import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('geofence')
@Controller('geofence')
export class GeofenceController {
  constructor(private readonly geofenceService: GeofenceService) {}

  @Post('verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify if a location coordinate is inside an office geofence polygon' })
  @ApiResponse({ status: 200, type: VerifyLocationResponseDto })
  @ApiMessage('Location verification completed')
  async verify(@Body() dto: VerifyLocationDto): Promise<VerifyLocationResponseDto> {
    return this.geofenceService.verifyLocation(dto);
  }
}
