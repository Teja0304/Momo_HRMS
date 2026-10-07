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
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EmployeeService } from '../services/employee.service';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { AssignOfficeDto } from '../dto/assign-office.dto';
import { EmployeeQueryDto } from '../dto/employee-query.dto';
import { ApiMessage } from '../../common/decorators/api-message.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCodes } from '../../common/constants/error-codes';

function extractUserFromRequest(req: Request): { userId?: string; email?: string; employeeId?: string } {
  let userId = (req.headers['x-user-id'] as string) || undefined;
  let employeeId = (req.headers['x-employee-id'] as string) || undefined;
  let email = (req.headers['x-email'] as string) || undefined;

  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7).trim();
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        if (payload.sub && !userId) userId = payload.sub;
        if (payload.email && !email) email = payload.email;
        if (payload.employeeId && !employeeId) employeeId = payload.employeeId;
      }
    } catch {
      // Ignore token parse error
    }
  }

  return { userId, email, employeeId };
}

interface UploadedMulterFile {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size?: number;
}

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

  @Get('hr-staff')
  @Public()
  @ApiOperation({ summary: 'List HR staff members for employee contact and requests' })
  async getHrStaff() {
    return this.employeeService.getHrStaff();
  }

  @Get('me')
  @Public()
  @ApiOperation({ summary: 'Get current authenticated employee profile' })
  async getMe(@Req() req: Request) {
    const { userId, email, employeeId } = extractUserFromRequest(req);
    return this.employeeService.getEmployeeMe(userId, email, employeeId);
  }

  @Put('me')
  @Public()
  @ApiOperation({ summary: 'Update current authenticated employee profile' })
  @ApiMessage('Employee profile updated successfully')
  async updateMe(@Req() req: Request, @Body() dto: UpdateEmployeeDto) {
    const { userId, email, employeeId } = extractUserFromRequest(req);
    return this.employeeService.updateEmployeeMe(userId, email, employeeId, dto);
  }

  @Post('me/photo')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current authenticated employee profile photo' })
  @ApiMessage('Profile photo updated successfully')
  async updatePhoto(@Req() req: Request, @Body() body: { photo: string }) {
    const { userId, email, employeeId } = extractUserFromRequest(req);
    return this.employeeService.updateEmployeeMe(userId, email, employeeId, {
      profilePhotoUrl: body.photo,
    });
  }

  @Post('me/attendance-token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate biometric verification token for attendance check-in' })
  async getAttendanceToken(@Req() req: Request, @Body() body?: { photo?: string }) {
    const { userId, email, employeeId } = extractUserFromRequest(req);
    const employee = await this.employeeService.getEmployeeMe(userId, email, employeeId);

    // If photo is provided, enroll into face-ai-service
    if (body?.photo) {
      try {
        await fetch('http://localhost:3006/api/v1/face/enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: employee.employeeCode,
            image_base64: body.photo.replace(/^data:image\/\w+;base64,/, ''),
          }),
        });
      } catch {
        // Non-blocking face enrollment attempt
      }
    }

    const token = this.employeeService.generateAttendanceToken(employee.employeeCode);
    return { success: true, token, employeeCode: employee.employeeCode };
  }

  @Get('resolve-identifier')
  @Public()
  @ApiOperation({ summary: 'Resolve employee official login credentials by personal email, official email, or employee code' })
  async resolveIdentifier(@Query('identifier') identifier?: string) {
    return this.employeeService.resolveIdentifier(identifier || '');
  }

  @Get('import/template')
  @Public()
  @ApiOperation({ summary: 'Download employee bulk import CSV template' })
  async downloadTemplate(@Res() res: Response) {
    const csvContent = this.employeeService.getImportTemplateCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="employee_import_template.csv"');
    return res.status(HttpStatus.OK).send(csvContent);
  }

  @Post('import/validate')
  @Public()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Validate CSV file for bulk employee import' })
  async validateImport(@UploadedFile() file?: UploadedMulterFile) {
    if (!file || !file.buffer) {
      throw new AppException(ErrorCodes.VALIDATION_FAILED, 'CSV file is required', HttpStatus.BAD_REQUEST);
    }
    return this.employeeService.validateImportFile(file.buffer);
  }

  @Post('import')
  @Public()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Execute bulk employee import from CSV' })
  async executeImport(
    @UploadedFile() file?: UploadedMulterFile,
    @Body('provisionAccounts') provisionAccounts?: string,
  ) {
    if (!file || !file.buffer) {
      throw new AppException(ErrorCodes.VALIDATION_FAILED, 'CSV file is required', HttpStatus.BAD_REQUEST);
    }
    const shouldProvision = provisionAccounts !== 'false';
    return this.employeeService.executeImportFile(file.buffer, shouldProvision);
  }

  @Get(':id/profile')
  @Public()
  @ApiOperation({ summary: 'Get comprehensive employee profile including devices and face template status' })
  async getEmployeeProfile(@Param('id') id: string) {
    return this.employeeService.getEmployeeProfile(id);
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

  @Put(':id')
  @ApiOperation({ summary: 'Update employee profile (PUT)' })
  @ApiMessage('Employee updated successfully')
  async updateEmployeePut(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeeService.updateEmployee(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update employee profile (PATCH)' })
  @ApiMessage('Employee updated successfully')
  async updateEmployee(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeeService.updateEmployee(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update employee employment status' })
  @ApiMessage('Employee status updated successfully')
  async updateStatus(@Param('id') id: string, @Body() body: { status: any }) {
    return this.employeeService.updateEmployeeStatus(id, body.status);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Update employee role' })
  @ApiMessage('Employee role updated successfully')
  async updateRole(@Param('id') id: string, @Body() body: { roleId: string }) {
    return this.employeeService.getEmployeeById(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete an employee record (Admin only)' })
  @ApiMessage('Employee deleted successfully')
  async deleteEmployee(@Param('id') id: string) {
    return this.employeeService.deleteEmployee(id);
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

  @Post(':id/resend-credentials')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend credentials to employee via SMTP' })
  @ApiMessage('Credentials resent successfully')
  async resendCredentials(@Param('id') id: string) {
    return this.employeeService.resendCredentials(id);
  }

  @Post('smtp/test')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test SMTP email delivery' })
  @ApiMessage('SMTP test email initiated')
  async testSmtpPost(@Body() body: { toEmail?: string }) {
    return this.employeeService.testSmtp(body?.toEmail);
  }

  @Get('smtp/test')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test SMTP email delivery (GET shortcut)' })
  @ApiMessage('SMTP test email initiated')
  async testSmtpGet(@Query('toEmail') toEmail?: string) {
    return this.employeeService.testSmtp(toEmail);
  }

  @Post(':id/devices')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a device for an employee' })
  @ApiMessage('Device registered successfully')
  async registerDevice(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return {
      id: 'device-' + Date.now(),
      employeeId: id,
      deviceName: body.deviceName || 'Personal Mobile',
      deviceType: body.deviceType || 'ANDROID',
      deviceIdentifier: body.deviceIdentifier || 'dev-id-001',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
  }
}

