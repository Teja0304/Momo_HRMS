import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GeofenceService } from '../services/geofence.service';
import { CreateOfficeDto } from '../dto/create-office.dto';
import { SetPolygonDto } from '../dto/set-polygon.dto';
import { OfficeResponseDto } from '../dto/office-response.dto';
import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('offices')
@Controller('offices')
export class OfficeController {
  constructor(private readonly geofenceService: GeofenceService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all offices with their active geofence polygons' })
  @ApiResponse({ status: 200, type: [OfficeResponseDto] })
  async listOffices() {
    return this.geofenceService.listOffices();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get single office details with active polygon' })
  @ApiResponse({ status: 200, type: OfficeResponseDto })
  async getOfficeById(@Param('id') id: string) {
    return this.geofenceService.getOfficeById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new office (HR/Admin only)' })
  @ApiMessage('Office created successfully')
  async createOffice(@Body() dto: CreateOfficeDto) {
    return this.geofenceService.createOffice(dto);
  }

  @Put(':id/polygon')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set or update office geofence polygon (HR/Admin only)' })
  @ApiMessage('Office geofence polygon updated successfully')
  async setPolygon(@Param('id') id: string, @Body() dto: SetPolygonDto) {
    return this.geofenceService.setOfficePolygon(id, dto);
  }
}
