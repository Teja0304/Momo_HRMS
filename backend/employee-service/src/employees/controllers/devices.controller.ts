import { Body, Controller, HttpCode, HttpStatus, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiMessage } from '../../common/decorators/api-message.decorator';

@ApiTags('devices')
@Controller('devices')
export class DevicesController {
  @Patch(':id/status')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update device status' })
  @ApiMessage('Device status updated successfully')
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return {
      id,
      status: body.status || 'ACTIVE',
      updatedAt: new Date().toISOString(),
    };
  }
}
