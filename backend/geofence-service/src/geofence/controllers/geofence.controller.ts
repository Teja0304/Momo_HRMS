import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
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

  @Delete('polygons/:id')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a specific geofence polygon by ID' })
  @ApiMessage('Geofence polygon deleted successfully')
  async deletePolygonById(@Param('id') id: string) {
    return this.geofenceService.deletePolygonById(id);
  }

  @Delete(':officeId')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete geofence polygon for an office' })
  @ApiMessage('Geofence deleted successfully')
  async deleteGeofenceByOfficeId(@Param('officeId') officeId: string) {
    return this.geofenceService.deleteOfficePolygon(officeId, true);
  }
}

