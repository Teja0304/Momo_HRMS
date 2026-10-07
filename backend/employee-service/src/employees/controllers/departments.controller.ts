import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationService } from '../services/organization.service';
import { CreateDepartmentDto } from '../dto/department.dto';
import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('departments')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all departments (for dropdowns and directory)' })
  async listDepartments(
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.orgService.listDepartments();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new department' })
  @ApiMessage('Department created successfully')
  async createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.orgService.createDepartment(dto);
  }
}
