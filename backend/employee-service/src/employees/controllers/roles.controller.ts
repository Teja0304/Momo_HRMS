import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationService } from '../services/organization.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all organization roles (for dropdowns and assignment)' })
  async listRoles() {
    return this.orgService.listRoles();
  }
}
