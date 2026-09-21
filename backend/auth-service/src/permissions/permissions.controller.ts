import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsService } from './permissions.service';

// JwtAuthGuard + PermissionsGuard are registered globally (see AppModule).
@ApiTags('permissions')
@ApiBearerAuth()
@Controller('auth/permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @Permissions('role.manage')
  findAll() {
    return this.permissionsService.findAll();
  }
}
