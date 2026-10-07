import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ExceptionsService } from '../services/exceptions.service';
import { CreateExceptionDto } from '../dto/create-exception.dto';
import { ApproveExceptionDto } from '../dto/approve-exception.dto';
import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { EmployeeAuthContext } from '../../common/interfaces/employee-auth-context.interface';
import { ExceptionStatus } from '@prisma/client';

@ApiTags('attendance-exceptions')
@Controller('attendance/exceptions')
export class ExceptionsController {
  constructor(private readonly exceptionsService: ExceptionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiMessage('Attendance exception requested successfully')
  async createException(@Body() dto: CreateExceptionDto) {
    return this.exceptionsService.createException(dto);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiMessage('Attendance exception decision recorded')
  async approveException(
    @CurrentEmployee() auth: EmployeeAuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveExceptionDto,
  ) {
    const approverUserId = auth?.userId || auth?.employeeId || 'HR_ADMIN';
    return this.exceptionsService.approveException(id, approverUserId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiMessage('Attendance exception cancelled')
  async deleteException(@Param('id', ParseUUIDPipe) id: string) {
    return this.exceptionsService.cancelException(id);
  }

  @Get()
  async listExceptions(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
    @Query('hrEmail') hrEmail?: string,
  ) {
    const validStatus =
      status && Object.values(ExceptionStatus).includes(status.toUpperCase() as ExceptionStatus)
        ? (status.toUpperCase() as ExceptionStatus)
        : undefined;
    return this.exceptionsService.getExceptions(employeeId, validStatus, hrEmail);
  }
}
