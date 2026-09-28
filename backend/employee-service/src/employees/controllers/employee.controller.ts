import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EmployeeService } from '../services/employee.service';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { AssignOfficeDto } from '../dto/assign-office.dto';
import { EmployeeQueryDto } from '../dto/employee-query.dto';
import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('employees')
@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new employee profile' })
  @ApiMessage('Employee created successfully')
  async createEmployee(@Body() dto: CreateEmployeeDto) {
    return this.employeeService.createEmployee(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List employees with pagination and filters' })
  async listEmployees(@Query() query: EmployeeQueryDto) {
    return this.employeeService.listEmployees(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee details by ID or Employee Code' })
  async getEmployeeById(@Param('id') id: string) {
    return this.employeeService.getEmployeeById(id);
  }

  @Get('by-user/:userId')
  @ApiOperation({ summary: 'Get employee profile linked to an Auth User UUID' })
  async getEmployeeByUserId(@Param('userId') userId: string) {
    return this.employeeService.getEmployeeByUserId(userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update employee profile' })
  @ApiMessage('Employee updated successfully')
  async updateEmployee(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeeService.updateEmployee(id, dto);
  }

  @Post(':id/offices')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign employee to an office workplace' })
  @ApiMessage('Office assignment created')
  async assignOffice(@Param('id') id: string, @Body() dto: AssignOfficeDto) {
    return this.employeeService.assignOffice(id, dto);
  }

  @Delete('offices/:assignmentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate an office assignment' })
  @ApiMessage('Office assignment deactivated')
  async removeOfficeAssignment(@Param('assignmentId') assignmentId: string) {
    return this.employeeService.removeOfficeAssignment(assignmentId);
  }

  /**
   * Internal / Gateway endpoint used by Attendance Service
   */
  @Get(':id/assignment-check')
  @Public()
  @ApiOperation({ summary: 'Check if an employee is currently assigned to a given office' })
  async checkOfficeAssignment(
    @Param('id') id: string,
    @Query('officeId') officeId: string,
  ) {
    const isAssigned = await this.employeeService.isAssignedToOffice(id, officeId);
    return { isAssigned, employeeId: id, officeId };
  }
}
