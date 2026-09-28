import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationService } from '../services/organization.service';
import { CreateDepartmentDto } from '../dto/department.dto';
import { CreateDesignationDto } from '../dto/designation.dto';
import { ApiMessage } from '../../common/decorators/api-message.decorator';

@ApiTags('organization')
@Controller('organization')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get('departments')
  @ApiOperation({ summary: 'List all departments with their designations' })
  async listDepartments() {
    return this.orgService.listDepartments();
  }

  @Post('departments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new department' })
  @ApiMessage('Department created successfully')
  async createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.orgService.createDepartment(dto);
  }

  @Get('designations')
  @ApiOperation({ summary: 'List designations' })
  async listDesignations(@Query('departmentId') departmentId?: string) {
    return this.orgService.listDesignations(departmentId);
  }

  @Post('designations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new designation' })
  @ApiMessage('Designation created successfully')
  async createDesignation(@Body() dto: CreateDesignationDto) {
    return this.orgService.createDesignation(dto);
  }
}
