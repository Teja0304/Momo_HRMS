import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ROLE_NAMES } from '../common/constants/rbac.constants';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

// JwtAuthGuard + RolesGuard + PermissionsGuard are registered globally
// (see AppModule); this controller only declares its requirements.
@ApiTags('roles')
@ApiBearerAuth()
@Controller('auth/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permissions('role.manage')
  findAll() {
    return this.rolesService.findAll();
  }

  @Post()
  @Roles(ROLE_NAMES.SUPER_ADMIN)
  @Permissions('role.manage')
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  @Roles(ROLE_NAMES.SUPER_ADMIN)
  @Permissions('role.manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }
}
