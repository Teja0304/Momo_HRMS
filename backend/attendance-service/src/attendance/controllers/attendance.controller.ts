import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AttendanceService } from '../services/attendance.service';
import { CheckInDto } from '../dto/check-in.dto';
import { CheckOutDto } from '../dto/check-out.dto';
import { GeofenceExitDto } from '../dto/geofence-exit.dto';
import { GeofenceReturnDto } from '../dto/geofence-return.dto';
import { SyncDto } from '../dto/sync.dto';
import { HistoryQueryDto } from '../dto/history-query.dto';
import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { CurrentEmployee } from '../../common/decorators/current-employee.decorator';
import { EmployeeAuthContext } from '../../common/interfaces/employee-auth-context.interface';

@ApiTags('attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @HttpCode(HttpStatus.CREATED)
  @ApiMessage('Attendance checked in successfully')
  async checkIn(@CurrentEmployee() employee: EmployeeAuthContext, @Body() dto: CheckInDto) {
    const result = await this.attendanceService.checkIn(employee.employeeId, dto);
    return result.session;
  }

  @Post('check-out')
  @HttpCode(HttpStatus.OK)
  @ApiMessage('Attendance checked out successfully')
  async checkOut(@CurrentEmployee() employee: EmployeeAuthContext, @Body() dto: CheckOutDto) {
    const result = await this.attendanceService.checkOut(employee.employeeId, dto);
    return result.session;
  }

  @Post('geofence-exit')
  @HttpCode(HttpStatus.OK)
  @ApiMessage('Geofence exit recorded')
  async geofenceExit(@CurrentEmployee() employee: EmployeeAuthContext, @Body() dto: GeofenceExitDto) {
    const result = await this.attendanceService.geofenceExit(employee.employeeId, dto);
    return result.session;
  }

  @Post('geofence-return')
  @HttpCode(HttpStatus.OK)
  @ApiMessage('Geofence return recorded')
  async geofenceReturn(@CurrentEmployee() employee: EmployeeAuthContext, @Body() dto: GeofenceReturnDto) {
    const result = await this.attendanceService.geofenceReturn(employee.employeeId, dto);
    return result.session;
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiMessage('Offline events synced')
  async sync(@CurrentEmployee() employee: EmployeeAuthContext, @Body() dto: SyncDto) {
    return this.attendanceService.sync(employee.employeeId, dto);
  }

  @Get('all-today')
  async allToday() {
    return this.attendanceService.getAllToday();
  }

  @Get('all-history')
  async allHistory(@Query() query: HistoryQueryDto) {
    return this.attendanceService.getAllHistory(query);
  }

  private isHrOrAdmin(roles?: string[]): boolean {
    if (!roles || !roles.length) return false;
    return roles.some((r) => {
      const clean = String(r).replace(/['"\[\]]/g, '').trim().toUpperCase();
      return ['HR', 'ADMIN', 'HR_ADMIN', 'SUPER_ADMIN'].includes(clean);
    });
  }

  @Get('today')
  async today(
    @CurrentEmployee() employee: EmployeeAuthContext,
    @Query('all') all?: string,
    @Query('employeeId') employeeIdQuery?: string,
  ) {
    if (all === 'true' || employeeIdQuery === 'ALL') {
      return this.attendanceService.getAllToday();
    }
    const isHrOrAdmin = this.isHrOrAdmin(employee?.roles);
    if (isHrOrAdmin && !employeeIdQuery) {
      return this.attendanceService.getAllToday();
    }
    const targetEmployeeId = employeeIdQuery || employee.employeeId;
    return this.attendanceService.getToday(targetEmployeeId);
  }

  @Get('history')
  async history(
    @CurrentEmployee() employee: EmployeeAuthContext,
    @Query() query: HistoryQueryDto,
    @Query('all') all?: string,
    @Query('employeeId') employeeIdQuery?: string,
  ) {
    const effectiveAll =
      all === 'true' ||
      employeeIdQuery === 'ALL' ||
      query.all === 'true' ||
      query.employeeId === 'ALL';
    if (effectiveAll) {
      return this.attendanceService.getAllHistory(query);
    }
    const isHrOrAdmin = this.isHrOrAdmin(employee?.roles);
    const targetEmployeeId = employeeIdQuery || query.employeeId || employee?.employeeId;
    if (isHrOrAdmin && !employeeIdQuery && !query.employeeId) {
      return this.attendanceService.getAllHistory(query);
    }
    return this.attendanceService.getHistory(targetEmployeeId, query);
  }

  @Get(':sessionId')
  async getById(
    @CurrentEmployee() employee: EmployeeAuthContext,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.attendanceService.getById(employee.employeeId, sessionId);
  }
}
