import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
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

  @Delete(':id/polygon')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete or remove geofence polygon for an office (HR/Admin only)' })
  @ApiMessage('Office geofence polygon deleted successfully')
  async deletePolygon(
    @Param('id') id: string,
    @Query('hard') hard?: string,
  ) {
    const isHard = hard === undefined || hard === 'true';
    return this.geofenceService.deleteOfficePolygon(id, isHard);
  }

  @Delete(':id')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an office and all its geofence polygons (HR/Admin only)' })
  @ApiMessage('Office deleted successfully')
  async deleteOffice(
    @Param('id') id: string,
    @Query('hard') hard?: string,
  ) {
    const isHard = hard === undefined || hard === 'true';
    return this.geofenceService.deleteOffice(id, isHard);
  }
}

