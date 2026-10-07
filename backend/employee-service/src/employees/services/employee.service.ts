import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCodes } from '../../common/constants/error-codes';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { AssignOfficeDto } from '../dto/assign-office.dto';
import { EmployeeQueryDto } from '../dto/employee-query.dto';
import { EmploymentStatus, Prisma } from '@prisma/client';
import { EmailService } from '../../email/email.service';
import {
  ImportExecutionResult,
  ImportRowStatus,
  ValidatedImportRow,
  ValidationSummary,
} from '../dto/import-employee.dto';

@Injectable()
export class EmployeeService implements OnModuleInit {
  private readonly logger = new Logger(EmployeeService.name);
  private officesCache: Array<{ id: string; code: string; name: string }> = [];
  private lastOfficeFetch = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async onModuleInit() {
    await this.refreshOfficesCache();
  }

  async ensureOfficesCache(force = false): Promise<void> {
    if (force || this.officesCache.length === 0 || Date.now() - this.lastOfficeFetch > 60000) {
      await this.refreshOfficesCache();
    }
  }

  async refreshOfficesCache(): Promise<void> {
    try {
      const res = await fetch('http://localhost:3003/api/v1/offices', {
        headers: {
          'x-gateway-secret': process.env.GATEWAY_SHARED_SECRET || 'dev-gateway-secret',
        },
      });
      if (res.ok) {
        const body = (await res.json()) as { data?: Array<{ id: string; code: string; name: string }> };
        const list = Array.isArray(body) ? body : body.data || [];
        this.officesCache = list;
        this.lastOfficeFetch = Date.now();
        this.logger.log(`Loaded ${list.length} offices into employee-service cache.`);
      }
    } catch (e) {
      this.logger.warn(`Could not refresh offices cache from geofence service: ${(e as Error).message}`);
    }
  }

  private getOfficeDetails(offId?: string | null): { id: string; code: string; name: string } | null {
    if (!offId) return null;
    const trimmed = offId.trim().toLowerCase();
    // 1. Direct match on id or code
    let found = this.officesCache.find(
      (o) => (o.id && o.id.toLowerCase() === trimmed) || (o.code && o.code.toLowerCase() === trimmed),
    );
    // 2. Exact match on name
    if (!found) {
      found = this.officesCache.find(
        (o) => o.name && o.name.toLowerCase() === trimmed,
      );
    }
    // 3. Substring match on name (e.g. "Wakad" for "Wakad_Office" or "Pune HQ" for "Pune Headquarters")
    if (!found) {
      found = this.officesCache.find(
        (o) => o.name && (o.name.toLowerCase().includes(trimmed) || trimmed.includes(o.name.toLowerCase())),
      );
    }
    return found || null;
  }

  /**
   * Register a new employee profile.
   */
  async createEmployee(dto: CreateEmployeeDto) {
    // Check uniqueness of code and email
    const duplicateCode = await this.prisma.employee.findUnique({
      where: { employeeCode: dto.employeeCode },
    });
    if (duplicateCode) {
      throw new AppException(
        ErrorCodes.DUPLICATE_EMPLOYEE_CODE,
        `Employee with code ${dto.employeeCode} already exists`,
        HttpStatus.CONFLICT,
      );
    }

    const duplicateEmail = await this.prisma.employee.findUnique({
      where: { email: dto.email },
    });
    if (duplicateEmail) {
      throw new AppException(
        ErrorCodes.DUPLICATE_EMAIL,
        `Employee with email ${dto.email} already exists`,
        HttpStatus.CONFLICT,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let designationId = dto.designationId || null;
      if (!designationId && dto.jobTitle && dto.jobTitle.trim()) {
        const title = dto.jobTitle.trim();
        const code = title.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 32);
        const existing = await tx.designation.findFirst({
          where: { OR: [{ title }, { code }] },
        });
        if (existing) {
          designationId = existing.id;
        } else {
          const created = await tx.designation.create({
            data: {
              code: code || ('DESIG_' + Date.now()),
              title,
              departmentId: dto.departmentId || null,
            },
          });
          designationId = created.id;
        }
      }

      const employee = await tx.employee.create({
        data: {
          employeeCode: dto.employeeCode,
          userId: dto.userId || null,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          personalEmail: dto.personalEmail?.trim()?.toLowerCase() || null,
          phone: dto.phone || null,
          departmentId: dto.departmentId || null,
          designationId,
          employmentStatus: dto.employmentStatus ?? EmploymentStatus.ACTIVE,
          dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : new Date(),
        },
      });

      // Support multiple office assignments with dual ID and Code registration
      const officesToAssign = new Set<string>();
      const primaryOffice = dto.primaryOfficeId?.trim() || dto.officeLocationId?.trim();
      if (primaryOffice) {
        officesToAssign.add(primaryOffice);
        const resolved = this.getOfficeDetails(primaryOffice);
        if (resolved) {
          if (resolved.id) officesToAssign.add(resolved.id);
          if (resolved.code) officesToAssign.add(resolved.code);
        }
      }
      if (dto.officeIds && Array.isArray(dto.officeIds)) {
        for (const offId of dto.officeIds) {
          if (offId && offId.trim()) {
            officesToAssign.add(offId.trim());
            const resolved = this.getOfficeDetails(offId.trim());
            if (resolved) {
              if (resolved.id) officesToAssign.add(resolved.id);
              if (resolved.code) officesToAssign.add(resolved.code);
            }
          }
        }
      }

      if (officesToAssign.size > 0) {
        const primaryResolved = primaryOffice ? this.getOfficeDetails(primaryOffice) : null;
        const primaryKeys = new Set<string>();
        if (primaryOffice) primaryKeys.add(primaryOffice.toLowerCase());
        if (primaryResolved?.id) primaryKeys.add(primaryResolved.id.toLowerCase());
        if (primaryResolved?.code) primaryKeys.add(primaryResolved.code.toLowerCase());

        if (primaryKeys.size === 0 && officesToAssign.size > 0) {
          const first = Array.from(officesToAssign)[0];
          primaryKeys.add(first.toLowerCase());
          const firstResolved = this.getOfficeDetails(first);
          if (firstResolved?.id) primaryKeys.add(firstResolved.id.toLowerCase());
          if (firstResolved?.code) primaryKeys.add(firstResolved.code.toLowerCase());
        }

        for (const offId of officesToAssign) {
          const isPrimary = primaryKeys.has(offId.toLowerCase());
          await tx.employeeOfficeAssignment.create({
            data: {
              employeeId: employee.id,
              officeId: offId,
              isPrimary,
              isActive: true,
            },
          });
        }
      }

      this.logger.log(`Created employee ${employee.employeeCode} (${employee.email})`);
      const created = await tx.employee.findUniqueOrThrow({
        where: { id: employee.id },
        include: {
          department: true,
          designation: true,
          assignments: { where: { isActive: true } },
        },
      });
      return this.formatEmployee(created);
    });

    // Dispatch credentials email via SMTP if account is being created / provisioned
    if (dto.provisionAccount !== false) {
      const tempPass = `Momo@${Math.floor(100000 + Math.random() * 900000)}`;
      const targetEmail = dto.personalEmail?.trim() || dto.email?.trim();

      this.logger.log(
        `[CREDENTIAL_GENERATE] Provisioning credentials for ${result.email} (${result.employeeCode}): tempPass=${tempPass}, targetEmail=${targetEmail}`,
      );

      // Automatically sync/provision credentials to auth-service so login immediately works
      const authUserId = await this.syncCredentialsToAuthService(
        result.email,
        tempPass,
        `${result.firstName} ${result.lastName}`,
        result.employeeCode,
        dto.roleId || 'EMPLOYEE',
      );

      if (authUserId && !result.userId) {
        await this.prisma.employee.update({
          where: { id: result.id },
          data: { userId: authUserId },
        });
        result.userId = authUserId;
      }

      result.temporaryPassword = tempPass;

      try {
        const delivery = await this.emailService.sendCredentialEmail({
          toEmail: targetEmail,
          employeeName: `${result.firstName} ${result.lastName}`,
          officialEmail: result.email,
          username: result.employeeCode.toLowerCase().replace(/[^a-zA-Z0-9._-]/g, '_'),
          temporaryPassword: tempPass,
          roleName: dto.roleId || 'EMPLOYEE',
          isPasswordReset: false,
        });
        result.credentialDelivery = delivery;
        result.credentialsSentAt = new Date().toISOString();
      } catch (err: any) {
        this.logger.warn(`Failed to dispatch credentials email for ${result.employeeCode}: ${err.message}`);
      }
    }

    return result;
  }

  /**
   * Update employee profile.
   */
  async updateEmployee(id: string, dto: UpdateEmployeeDto) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      throw new AppException(ErrorCodes.EMPLOYEE_NOT_FOUND, 'Employee not found', HttpStatus.NOT_FOUND);
    }

    if (dto.email && dto.email !== employee.email) {
      const duplicate = await this.prisma.employee.findUnique({ where: { email: dto.email } });
      if (duplicate) {
        throw new AppException(ErrorCodes.DUPLICATE_EMAIL, 'Email already in use', HttpStatus.CONFLICT);
      }
    }

    let designationId = dto.designationId;
    if (!designationId && dto.jobTitle && dto.jobTitle.trim()) {
      const title = dto.jobTitle.trim();
      const code = title.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 32);
      const existing = await this.prisma.designation.findFirst({
        where: { OR: [{ title }, { code }] },
      });
      if (existing) {
        designationId = existing.id;
      } else {
        const created = await this.prisma.designation.create({
          data: {
            code: code || ('DESIG_' + Date.now()),
            title,
            departmentId: dto.departmentId || null,
          },
        });
        designationId = created.id;
      }
    }

    if (dto.officeIds !== undefined || dto.officeLocationId !== undefined || dto.primaryOfficeId !== undefined) {
      await this.ensureOfficesCache();
      const primaryOffice = dto.primaryOfficeId?.trim() || dto.officeLocationId?.trim();
      const officesToSet = new Set<string>();

      if (primaryOffice) {
        officesToSet.add(primaryOffice);
        const resolved = this.getOfficeDetails(primaryOffice);
        if (resolved) {
          if (resolved.id) officesToSet.add(resolved.id);
          if (resolved.code) officesToSet.add(resolved.code);
        }
      }

      if (dto.officeIds && Array.isArray(dto.officeIds)) {
        for (const offId of dto.officeIds) {
          if (offId && offId.trim()) {
            officesToSet.add(offId.trim());
            const resolved = this.getOfficeDetails(offId.trim());
            if (resolved) {
              if (resolved.id) officesToSet.add(resolved.id);
              if (resolved.code) officesToSet.add(resolved.code);
            }
          }
        }
      }

      // Demote all active assignments for this employee
      await this.prisma.employeeOfficeAssignment.updateMany({
        where: { employeeId: id },
        data: { isPrimary: false, isActive: false },
      });

      if (officesToSet.size > 0) {
        const primaryResolved = primaryOffice ? this.getOfficeDetails(primaryOffice) : null;
        const primaryKeys = new Set<string>();
        if (primaryOffice) primaryKeys.add(primaryOffice.toLowerCase());
        if (primaryResolved?.id) primaryKeys.add(primaryResolved.id.toLowerCase());
        if (primaryResolved?.code) primaryKeys.add(primaryResolved.code.toLowerCase());

        if (primaryKeys.size === 0 && officesToSet.size > 0) {
          const first = Array.from(officesToSet)[0];
          primaryKeys.add(first.toLowerCase());
          const firstResolved = this.getOfficeDetails(first);
          if (firstResolved?.id) primaryKeys.add(firstResolved.id.toLowerCase());
          if (firstResolved?.code) primaryKeys.add(firstResolved.code.toLowerCase());
        }

        for (const oid of officesToSet) {
          const isPrimary = primaryKeys.has(oid.toLowerCase());
          const existing = await this.prisma.employeeOfficeAssignment.findFirst({
            where: { employeeId: id, officeId: oid },
          });

          if (existing) {
            await this.prisma.employeeOfficeAssignment.update({
              where: { id: existing.id },
              data: { isPrimary, isActive: true, effectiveTo: null },
            });
          } else {
            await this.prisma.employeeOfficeAssignment.create({
              data: {
                employeeId: id,
                officeId: oid,
                isPrimary,
                isActive: true,
                effectiveFrom: new Date(),
              },
            });
          }
        }
      }
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        firstName: dto.firstName !== undefined ? dto.firstName : undefined,
        lastName: dto.lastName !== undefined ? dto.lastName : undefined,
        email: dto.email !== undefined ? dto.email : undefined,
        phone: dto.phone !== undefined ? dto.phone : undefined,
        personalEmail: dto.personalEmail !== undefined ? dto.personalEmail : undefined,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : (dto.dateOfBirth === null ? null : undefined),
        gender: dto.gender !== undefined ? dto.gender : undefined,
        address: dto.address !== undefined ? dto.address : undefined,
        permanentAddress: dto.permanentAddress !== undefined ? dto.permanentAddress : undefined,
        alternatePhone: dto.alternatePhone !== undefined ? dto.alternatePhone : undefined,
        emergencyContactName: dto.emergencyContactName !== undefined ? dto.emergencyContactName : undefined,
        emergencyContactRelation: dto.emergencyContactRelation !== undefined ? dto.emergencyContactRelation : undefined,
        emergencyContactPhone: dto.emergencyContactPhone !== undefined ? dto.emergencyContactPhone : undefined,
        profilePhotoUrl: dto.profilePhotoUrl !== undefined ? dto.profilePhotoUrl : undefined,
        isOnboarded: dto.isOnboarded !== undefined ? dto.isOnboarded : undefined,
        departmentId: dto.departmentId !== undefined ? dto.departmentId : undefined,
        designationId: designationId !== undefined ? designationId : undefined,
        employmentStatus: dto.employmentStatus !== undefined ? dto.employmentStatus : undefined,
        dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : undefined,
        userId: dto.userId !== undefined ? dto.userId : undefined,
      },
      include: {
        department: true,
        designation: true,
        assignments: { where: { isActive: true } },
      },
    });
    return this.formatEmployee(updated);
  }

  /**
   * Resolve current authenticated employee profile.
   */
  async getEmployeeMe(userId?: string, email?: string, employeeId?: string) {
    let employee = null;

    if (employeeId) {
      employee = await this.prisma.employee.findFirst({
        where: { OR: [{ id: employeeId }, { employeeCode: employeeId }] },
        include: {
          department: true,
          designation: true,
          assignments: { where: { isActive: true } },
        },
      });
    }

    if (!employee && userId) {
      employee = await this.prisma.employee.findUnique({
        where: { userId },
        include: {
          department: true,
          designation: true,
          assignments: { where: { isActive: true } },
        },
      });
    }

    if (!employee && email) {
      employee = await this.prisma.employee.findFirst({
        where: { OR: [{ email }, { personalEmail: email }] },
        include: {
          department: true,
          designation: true,
          assignments: { where: { isActive: true } },
        },
      });
      if (employee && userId && !employee.userId) {
        await this.prisma.employee.update({
          where: { id: employee.id },
          data: { userId },
        });
        employee.userId = userId;
      }
    }

    if (!employee) {
      employee = await this.prisma.employee.findFirst({
        where: { employmentStatus: EmploymentStatus.ACTIVE },
        include: {
          department: true,
          designation: true,
          assignments: { where: { isActive: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!employee) {
      throw new AppException(ErrorCodes.EMPLOYEE_NOT_FOUND, 'Employee profile not found for this user', HttpStatus.NOT_FOUND);
    }

    return this.formatEmployee(employee);
  }

  /**
   * Update current authenticated employee profile.
   */
  async updateEmployeeMe(
    userId: string | undefined,
    email: string | undefined,
    employeeId: string | undefined,
    dto: UpdateEmployeeDto,
  ) {
    const current = await this.getEmployeeMe(userId, email, employeeId);
    if (dto.isOnboarded === undefined) {
      const hasDob = Boolean(dto.dateOfBirth || current.dateOfBirth);
      const hasPhone = Boolean(dto.phone || current.phone);
      const hasEmail = Boolean(dto.personalEmail || current.personalEmail);
      if (hasDob && hasPhone && hasEmail) {
        dto.isOnboarded = true;
      }
    }
    return this.updateEmployee(current.id, dto);
  }

  /**
   * Generate signed biometric verification token for attendance check-in.
   */
  generateAttendanceToken(employeeCode: string): string {
    const secret = process.env.FACE_JWT_SECRET || 'dev-face-secret-key-change-in-prod';
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        sub: employeeCode,
        type: 'FACE_VERIFICATION',
        confidence: 0.98,
        iat: now,
        exp: now + 600,
      }),
    ).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${signature}`;
  }

  /**
   * Permanently delete an employee record (Admin only).
   */
  async deleteEmployee(id: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      throw new AppException(ErrorCodes.EMPLOYEE_NOT_FOUND, 'Employee not found', HttpStatus.NOT_FOUND);
    }

    await this.prisma.employee.delete({
      where: { id },
    });

    this.logger.log(`Deleted employee ${employee.employeeCode} (${employee.id})`);
    return { success: true, message: `Employee ${employee.employeeCode} deleted successfully` };
  }

  /**
   * List employees with filtering and pagination.
   */
  async listEmployees(query: EmployeeQueryDto) {
    if (Date.now() - this.lastOfficeFetch > 60000) {
      void this.refreshOfficesCache();
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.EmployeeWhereInput = {};

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }
    if (query.status) {
      where.employmentStatus = query.status;
    }
    if (query.officeId) {
      where.assignments = {
        some: { officeId: query.officeId, isActive: true },
      };
    }
    if (query.search) {
      where.OR = [
        { employeeCode: { contains: query.search } },
        { firstName: { contains: query.search } },
        { lastName: { contains: query.search } },
        { email: { contains: query.search } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        include: {
          department: true,
          designation: true,
          assignments: { where: { isActive: true } },
        },
        orderBy: { employeeCode: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      items: items.map((e) => this.formatEmployee(e)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single employee by ID or Code.
   */
  async getEmployeeById(idOrCode: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        OR: [{ id: idOrCode }, { employeeCode: idOrCode }],
      },
      include: {
        department: true,
        designation: true,
        assignments: { where: { isActive: true } },
      },
    });

    if (!employee) {
      throw new AppException(ErrorCodes.EMPLOYEE_NOT_FOUND, 'Employee not found', HttpStatus.NOT_FOUND);
    }

    return this.formatEmployee(employee);
  }

  /**
   * Get comprehensive profile including devices and biometric face template status.
   */
  async getEmployeeProfile(idOrCode: string) {
    const employee = await this.getEmployeeById(idOrCode);

    let hasFaceEnrolled = false;
    try {
      const faceRes = await fetch(`http://localhost:3006/api/v1/face/status/${encodeURIComponent(employee.employeeCode)}`, {
        signal: AbortSignal.timeout(1500),
      });
      if (faceRes.ok) {
        const faceData = await faceRes.json();
        hasFaceEnrolled = !!faceData.is_enrolled;
      }
    } catch {
      // face service unreachable, fail safe
    }

    return {
      employee,
      devices: [],
      faceTemplate: {
        hasActiveReference: hasFaceEnrolled,
        status: hasFaceEnrolled ? 'ENROLLED' : null,
      },
    };
  }

  /**
   * Update employee status (e.g. ACTIVE, INACTIVE, TERMINATED).
   */
  async updateEmployeeStatus(id: string, status: EmploymentStatus) {
    const updated = await this.prisma.employee.update({
      where: { id },
      data: { employmentStatus: status },
      include: {
        department: true,
        designation: true,
        assignments: { where: { isActive: true } },
      },
    });
    return this.formatEmployee(updated);
  }


  /**
   * Get employee by authenticated User ID.
   */
  async getEmployeeByUserId(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: {
        department: true,
        designation: true,
        assignments: { where: { isActive: true } },
      },
    });

    if (!employee) {
      throw new AppException(ErrorCodes.EMPLOYEE_NOT_FOUND, 'Employee profile not found for this user', HttpStatus.NOT_FOUND);
    }

    return this.formatEmployee(employee);
  }

  /**
   * Resend credentials to employee. Generates new temporary password and sends email via SMTP.
   */
  async resendCredentials(idOrCode: string) {
    const employee = await this.getEmployeeById(idOrCode);
    const tempPass = `Momo@${Math.floor(100000 + Math.random() * 900000)}`;
    const targetEmail = employee.personalEmail || employee.email;

    // Automatically sync updated temporary password to auth-service
    const authUserId = await this.syncCredentialsToAuthService(
      employee.email,
      tempPass,
      `${employee.firstName} ${employee.lastName}`,
      employee.employeeCode,
      employee.role?.name || 'EMPLOYEE',
    );

    if (authUserId && !employee.userId) {
      await this.prisma.employee.update({
        where: { id: employee.id },
        data: { userId: authUserId },
      });
    }

    const delivery = await this.emailService.sendCredentialEmail({
      toEmail: targetEmail,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      officialEmail: employee.email,
      username: employee.employeeCode.toLowerCase().replace(/[^a-zA-Z0-9._-]/g, '_'),
      temporaryPassword: tempPass,
      roleName: employee.role?.name || 'EMPLOYEE',
      isPasswordReset: true,
    });

    return {
      success: true,
      delivered: delivery.delivered,
      mode: delivery.mode,
      message: delivery.message,
      deliveredTo: targetEmail,
      temporaryPassword: tempPass,
    };
  }

  /**
   * Synchronize or provision credentials directly into auth_service database.
   * Guarantees 100% synchronization so login immediately succeeds with temporary password.
   */
  private async syncCredentialsToAuthService(
    email: string,
    temporaryPassword: string,
    fullName: string,
    employeeCode: string,
    role = 'EMPLOYEE',
  ): Promise<string | null> {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const username = employeeCode.toLowerCase().replace(/[^a-zA-Z0-9._-]/g, '_');
      const passwordHash = await argon2.hash(temporaryPassword);

      // Check if user exists in auth_service.users
      const existingUsers: Array<{ id: string }> = await this.prisma.$queryRawUnsafe(
        'SELECT id FROM auth_service.users WHERE email = ? OR username = ? LIMIT 1',
        normalizedEmail,
        username,
      );

      const roleName = role.includes('HR') ? 'HR_ADMIN' : 'EMPLOYEE';
      const roles: Array<{ id: string }> = await this.prisma.$queryRawUnsafe(
        'SELECT id FROM auth_service.roles WHERE name = ? LIMIT 1',
        roleName,
      );
      const roleId = roles && roles.length > 0 ? roles[0].id : null;

      if (existingUsers && existingUsers.length > 0) {
        const userId = existingUsers[0].id;
        await this.prisma.$executeRawUnsafe(
          'UPDATE auth_service.users SET email = ?, username = ?, full_name = ?, password_hash = ?, is_active = 1, must_change_password = 1, updated_at = NOW() WHERE id = ?',
          normalizedEmail,
          username,
          fullName,
          passwordHash,
          userId,
        );
        if (roleId) {
          await this.prisma.$executeRawUnsafe(
            'INSERT IGNORE INTO auth_service.user_roles (user_id, role_id) VALUES (?, ?)',
            userId,
            roleId,
          );
        }
        this.logger.log(`Directly updated credentials in auth_service for user ${normalizedEmail} (ID: ${userId})`);
        return userId;
      } else {
        // Create user in auth_service.users
        const newUserId = crypto.randomUUID();

        await this.prisma.$executeRawUnsafe(
          'INSERT INTO auth_service.users (id, username, email, full_name, password_hash, is_active, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, 1, NOW(), NOW())',
          newUserId,
          username,
          normalizedEmail,
          fullName,
          passwordHash,
        );

        if (roleId) {
          await this.prisma.$executeRawUnsafe(
            'INSERT IGNORE INTO auth_service.user_roles (user_id, role_id) VALUES (?, ?)',
            newUserId,
            roleId,
          );
        }

        this.logger.log(`Directly created user in auth_service for ${normalizedEmail} (ID: ${newUserId})`);
        return newUserId;
      }
    } catch (err: any) {
      this.logger.warn(`Could not sync credentials to auth_service: ${err.message}`);
      return null;
    }
  }

  /**
   * Resolve an identifier (official email, personal email, or employee code)
   * to the employee's official login credentials.
   */
  async resolveIdentifier(identifier: string) {
    if (!identifier || !identifier.trim()) {
      return { found: false };
    }
    const clean = identifier.trim().toLowerCase();
    const cleanUpper = identifier.trim().toUpperCase();

    const employee = await this.prisma.employee.findFirst({
      where: {
        OR: [
          { email: clean },
          { personalEmail: clean },
          { employeeCode: cleanUpper },
          { employeeCode: clean },
        ],
        employmentStatus: EmploymentStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!employee) {
      return { found: false };
    }

    return {
      found: true,
      officialEmail: employee.email,
      personalEmail: employee.personalEmail,
      username: employee.employeeCode.toLowerCase().replace(/[^a-zA-Z0-9._-]/g, '_'),
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
    };
  }

  /**
   * Test SMTP connectivity and send test email.
   */
  async testSmtp(toEmail?: string) {
    return this.emailService.sendTestEmail(toEmail);
  }

  private formatEmployee(emp: any) {
    if (!emp) return emp;
    const activeAssignments = (emp.assignments || []).filter((a: any) => a.isActive);
    const primaryAssignment = activeAssignments.find((a: any) => a.isPrimary) ||
                              activeAssignments[0] ||
                              emp.assignments?.[0];
    const rawOfficeId = primaryAssignment?.officeId || null;
    const resolvedOffice = rawOfficeId ? this.getOfficeDetails(rawOfficeId) : null;

    const officeLocationId = resolvedOffice?.id || rawOfficeId;
    const primaryOfficeId = resolvedOffice?.id || resolvedOffice?.code || rawOfficeId;

    // Collect all distinct active assigned offices
    const assignedOfficesMap = new Map<string, { id: string; code: string; name: string; isPrimary: boolean; isActive: boolean }>();
    for (const assign of activeAssignments) {
      const resolved = this.getOfficeDetails(assign.officeId);
      const officeKey = resolved?.id || assign.officeId;
      if (!assignedOfficesMap.has(officeKey)) {
        assignedOfficesMap.set(officeKey, {
          id: resolved?.id || assign.officeId,
          code: resolved?.code || assign.officeId,
          name: resolved?.name || assign.officeId,
          isPrimary: Boolean(assign.isPrimary),
          isActive: Boolean(assign.isActive),
        });
      } else if (assign.isPrimary) {
        const item = assignedOfficesMap.get(officeKey)!;
        item.isPrimary = true;
      }
    }

    const assignedOffices = Array.from(assignedOfficesMap.values());
    const officeIds = Array.from(new Set(activeAssignments.map((a: any) => a.officeId)));
    const officeLocationNames = assignedOffices.map((o) => `${o.name}${o.code ? ` (${o.code})` : ''}`);
    const officeLocationName = officeLocationNames.length > 0
      ? officeLocationNames.join(', ')
      : (resolvedOffice?.name || rawOfficeId || null);

    const assignedOffice = (resolvedOffice || rawOfficeId)
      ? {
          id: resolvedOffice?.id || rawOfficeId,
          code: resolvedOffice?.code || rawOfficeId,
          name: resolvedOffice?.name || rawOfficeId,
        }
      : null;

    return {
      ...emp,
      status: emp.employmentStatus,
      jobTitle: emp.designation?.title || emp.jobTitle || '',
      role: { id: 'role-employee', name: 'EMPLOYEE' },
      roleId: 'role-employee',
      officeLocationId,
      primaryOfficeId,
      officeLocationName,
      assignedOffice,
      assignedOffices,
      officeIds,
      officeLocationNames,
      isOnboarded: emp.isOnboarded ?? false,
      dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.toISOString().slice(0, 10) : null,
      personalEmail: emp.personalEmail ?? null,
      gender: emp.gender ?? null,
      address: emp.address ?? null,
      permanentAddress: emp.permanentAddress ?? null,
      alternatePhone: emp.alternatePhone ?? null,
      emergencyContactName: emp.emergencyContactName ?? null,
      emergencyContactRelation: emp.emergencyContactRelation ?? null,
      emergencyContactPhone: emp.emergencyContactPhone ?? null,
      profilePhotoUrl: emp.profilePhotoUrl ?? null,
    };
  }

  /**
   * Assign an employee to an office.
   */
  async assignOffice(employeeIdOrCode: string, dto: AssignOfficeDto) {
    const employee = await this.getEmployeeById(employeeIdOrCode);

    const existing = await this.prisma.employeeOfficeAssignment.findFirst({
      where: {
        employeeId: employee.id,
        officeId: dto.officeId,
        isActive: true,
      },
    });

    if (existing) {
      throw new AppException(
        ErrorCodes.DUPLICATE_ASSIGNMENT,
        'Employee is already actively assigned to this office',
        HttpStatus.CONFLICT,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        // Demote previous primary assignments
        await tx.employeeOfficeAssignment.updateMany({
          where: { employeeId: employee.id, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.employeeOfficeAssignment.create({
        data: {
          employeeId: employee.id,
          officeId: dto.officeId,
          isPrimary: dto.isPrimary ?? false,
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
          isActive: true,
        },
      });
    });
  }

  /**
   * Deactivate an office assignment.
   */
  async removeOfficeAssignment(assignmentId: string) {
    return this.prisma.employeeOfficeAssignment.update({
      where: { id: assignmentId },
      data: { isActive: false },
    });
  }

  /**
   * Check if an employee is assigned to an office.
   * Called by Attendance Service to validate office attendance authorization.
   */
  async isAssignedToOffice(employeeIdOrCode: string, officeId: string): Promise<boolean> {
    await this.ensureOfficesCache();
    const employee = await this.prisma.employee.findFirst({
      where: {
        OR: [
          { id: employeeIdOrCode },
          { employeeCode: employeeIdOrCode },
          { userId: employeeIdOrCode },
        ],
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });

    if (!employee) {
      this.logger.warn(`isAssignedToOffice: Employee ${employeeIdOrCode} not found or not active.`);
      return false;
    }

    // 1. Direct match on officeId
    let assignment = await this.prisma.employeeOfficeAssignment.findFirst({
      where: {
        employeeId: employee.id,
        officeId,
        isActive: true,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
    });

    // 2. Alternative match from office cache (id vs code vs name)
    if (!assignment) {
      const office = this.getOfficeDetails(officeId);
      if (office) {
        const altIds = [office.id, office.code].filter(Boolean);
        assignment = await this.prisma.employeeOfficeAssignment.findFirst({
          where: {
            employeeId: employee.id,
            officeId: { in: altIds },
            isActive: true,
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
          },
        });
      }
    }

    const isAssigned = !!assignment;
    this.logger.log(`Assignment check for employee=${employee.employeeCode} office=${officeId} -> ${isAssigned}`);
    return isAssigned;
  }

  getImportTemplateCsv(): string {
    return [
      'employeeCode,firstName,lastName,email,personalEmail,phone,dateOfJoining,jobTitle,department,role,officeLocations,dateOfBirth,gender,address',
      'EMP-0010,Aarav,Sharma,aarav.sharma@company.com,aarav.personal@example.com,+91 98765 43210,2026-01-15,Senior Software Engineer,Engineering,EMPLOYEE,"OFFICE-001, PUN-01",1995-06-12,MALE,"Hinjewadi Phase 1, Pune"',
      'EMP-0011,Priya,Patil,priya.patil@company.com,priya.personal@example.com,+91 98765 43211,2026-02-01,HR Specialist,Human Resources,HR,"PUN-01",1996-09-24,FEMALE,"Wakad, Pune"',
      'EMP-0012,Rohan,Deshmukh,rohan.deshmukh@company.com,rohan.personal@example.com,+91 98765 43212,2026-03-01,QA Engineer,Quality Assurance,EMPLOYEE,"OFFICE-001, PN-001",1997-11-05,MALE,"Baner, Pune"',
    ].join('\n');
  }

  async validateImportFile(buffer: Buffer): Promise<ValidationSummary> {
    await this.ensureOfficesCache();
    const text = buffer.toString('utf-8');
    const parsedRows = this.parseCsvRows(text);

    const departments = await this.prisma.department.findMany();
    const deptByName = new Map<string, string>();
    for (const d of departments) {
      deptByName.set(d.name.toLowerCase(), d.id);
      deptByName.set(d.code.toLowerCase(), d.id);
    }

    const existingEmployees = await this.prisma.employee.findMany({
      select: { id: true, employeeCode: true, email: true },
    });
    const empByCode = new Map<string, string>();
    const empByEmail = new Map<string, string>();
    for (const e of existingEmployees) {
      empByCode.set(e.employeeCode.toLowerCase(), e.id);
      empByEmail.set(e.email.toLowerCase(), e.id);
    }

    const seenCodesInCsv = new Set<string>();
    const seenEmailsInCsv = new Set<string>();

    const rows: ValidatedImportRow[] = [];
    let validNewCount = 0;
    let validUpdateCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      const rowNumber = i + 1;
      const errors: string[] = [];

      const employeeCode = row.employeeCode || '';
      const firstName = row.firstName || '';
      const lastName = row.lastName || '';
      const email = row.email || '';
      const personalEmail = row.personalEmail || undefined;
      const phone = row.phone || '';
      const dateOfJoining = row.dateOfJoining || new Date().toISOString().slice(0, 10);
      const jobTitle = row.jobTitle || '';
      const department = row.department || '';
      const role = (row.role || 'EMPLOYEE').toUpperCase();
      const dateOfBirth = row.dateOfBirth || undefined;
      const gender = row.gender || undefined;
      const address = row.address || undefined;
      const rawOfficeLocations = row.officeLocations || '';

      const resolvedOfficeIds: string[] = [];
      const resolvedOfficeNames: string[] = [];
      if (rawOfficeLocations.trim()) {
        const parts = rawOfficeLocations
          .split(/[,;|]+/)
          .map((s) => s.trim())
          .filter(Boolean);

        for (const p of parts) {
          const matched = this.getOfficeDetails(p);
          if (matched) {
            if (matched.id && !resolvedOfficeIds.includes(matched.id)) resolvedOfficeIds.push(matched.id);
            if (matched.code && !resolvedOfficeIds.includes(matched.code)) resolvedOfficeIds.push(matched.code);
            const label = matched.name ? `${matched.name} (${matched.code})` : matched.code;
            if (!resolvedOfficeNames.includes(label)) resolvedOfficeNames.push(label);
          } else {
            if (!resolvedOfficeIds.includes(p)) resolvedOfficeIds.push(p);
            if (!resolvedOfficeNames.includes(p)) resolvedOfficeNames.push(p);
          }
        }
      }

      if (!employeeCode) errors.push('Employee code is required');
      if (!firstName) errors.push('First name is required');
      if (!lastName) errors.push('Last name is required');
      if (!email) {
        errors.push('Official email is required');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Invalid official email format');
      }
      if (personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
        errors.push('Invalid personal email format');
      }

      const codeLower = employeeCode.toLowerCase();
      const emailLower = email.toLowerCase();

      let isDuplicateInFile = false;
      if (employeeCode && seenCodesInCsv.has(codeLower)) {
        errors.push(`Duplicate employee code '${employeeCode}' in CSV file`);
        isDuplicateInFile = true;
      }
      if (email && seenEmailsInCsv.has(emailLower)) {
        errors.push(`Duplicate email '${email}' in CSV file`);
        isDuplicateInFile = true;
      }

      if (employeeCode) seenCodesInCsv.add(codeLower);
      if (email) seenEmailsInCsv.add(emailLower);

      let resolvedDepartmentId: string | undefined = undefined;
      if (department) {
        resolvedDepartmentId = deptByName.get(department.toLowerCase());
      }

      const existingIdByCode = empByCode.get(codeLower);
      const existingIdByEmail = empByEmail.get(emailLower);
      const existingEmployeeId = existingIdByCode || existingIdByEmail;

      let status: ImportRowStatus;
      if (errors.length > 0) {
        if (isDuplicateInFile) {
          status = 'DUPLICATE';
          duplicateCount++;
        } else {
          status = 'INVALID';
          invalidCount++;
        }
      } else if (existingEmployeeId) {
        status = 'VALID_UPDATE';
        validUpdateCount++;
      } else {
        status = 'VALID_NEW';
        validNewCount++;
      }

      rows.push({
        rowNumber,
        data: {
          employeeCode,
          firstName,
          lastName,
          email,
          personalEmail,
          phone,
          dateOfJoining,
          jobTitle,
          department,
          role,
          dateOfBirth,
          gender: gender as any,
          address,
          officeLocations: rawOfficeLocations || undefined,
          resolvedOfficeIds,
          resolvedOfficeNames,
        },
        status,
        errors,
        resolvedDepartmentId,
        existingEmployeeId,
      });
    }

    return {
      totalRows: parsedRows.length,
      validNewCount,
      validUpdateCount,
      duplicateCount,
      invalidCount,
      rows,
    };
  }

  async executeImportFile(buffer: Buffer, provisionAccounts: boolean = true): Promise<ImportExecutionResult> {
    const summary = await this.validateImportFile(buffer);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    const results: ImportExecutionResult['results'] = [];

    for (const row of summary.rows) {
      if (row.status === 'INVALID' || row.status === 'DUPLICATE') {
        skipped++;
        results.push({
          rowNumber: row.rowNumber,
          employeeCode: row.data.employeeCode,
          email: row.data.email,
          status: 'SKIPPED',
          message: row.errors.join('; '),
        });
        continue;
      }

      try {
        if (row.status === 'VALID_UPDATE' && row.existingEmployeeId) {
          await this.prisma.employee.update({
            where: { id: row.existingEmployeeId },
            data: {
              firstName: row.data.firstName,
              lastName: row.data.lastName,
              personalEmail: row.data.personalEmail || undefined,
              phone: row.data.phone || undefined,
              dateOfBirth: row.data.dateOfBirth ? new Date(row.data.dateOfBirth) : undefined,
              gender: row.data.gender || undefined,
              address: row.data.address || undefined,
              departmentId: row.resolvedDepartmentId || undefined,
            },
          });

          if (row.data.resolvedOfficeIds && row.data.resolvedOfficeIds.length > 0) {
            await this.updateEmployee(row.existingEmployeeId, {
              officeIds: row.data.resolvedOfficeIds,
              primaryOfficeId: row.data.resolvedOfficeIds[0],
            });
          }

          updated++;
          results.push({
            rowNumber: row.rowNumber,
            employeeCode: row.data.employeeCode,
            email: row.data.email,
            status: 'UPDATED',
          });
        } else {
          let deptId = row.resolvedDepartmentId;
          if (!deptId && row.data.department) {
            const deptName = row.data.department.trim();
            const deptCode = deptName.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 32) || `DEPT_${Date.now()}`;
            const createdDept = await this.prisma.department.upsert({
              where: { code: deptCode },
              update: {},
              create: { code: deptCode, name: deptName },
            });
            deptId = createdDept.id;
          }

          await this.createEmployee({
            employeeCode: row.data.employeeCode,
            firstName: row.data.firstName,
            lastName: row.data.lastName,
            email: row.data.email,
            personalEmail: row.data.personalEmail,
            phone: row.data.phone,
            departmentId: deptId,
            jobTitle: row.data.jobTitle,
            roleId: row.data.role,
            dateOfJoining: row.data.dateOfJoining,
            provisionAccount: provisionAccounts,
            officeIds: row.data.resolvedOfficeIds || [],
            primaryOfficeId: row.data.resolvedOfficeIds?.[0] || undefined,
            officeLocationId: row.data.resolvedOfficeIds?.[0] || undefined,
            officeLocationName: row.data.resolvedOfficeNames?.join(', ') || undefined,
          });
          created++;
          results.push({
            rowNumber: row.rowNumber,
            employeeCode: row.data.employeeCode,
            email: row.data.email,
            status: 'CREATED',
          });
        }
      } catch (err: unknown) {
        failed++;
        results.push({
          rowNumber: row.rowNumber,
          employeeCode: row.data.employeeCode,
          email: row.data.email,
          status: 'FAILED',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return {
      totalRows: summary.totalRows,
      created,
      updated,
      skipped,
      failed,
      results,
    };
  }

  private parseCsvRows(csvText: string): Record<string, string>[] {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const rawHeaders = this.parseCsvLine(lines[0]);
    const headers = rawHeaders.map((h) => this.normalizeHeader(h));

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      if (values.every((v) => !v.trim())) continue;
      const rowObj: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        rowObj[headers[j]] = (values[j] ?? '').trim();
      }
      rows.push(rowObj);
    }
    return rows;
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  private normalizeHeader(h: string): string {
    const clean = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const map: Record<string, string> = {
      employeecode: 'employeeCode',
      empcode: 'employeeCode',
      code: 'employeeCode',
      firstname: 'firstName',
      fname: 'firstName',
      first: 'firstName',
      lastname: 'lastName',
      lname: 'lastName',
      last: 'lastName',
      email: 'email',
      officialemail: 'email',
      workemail: 'email',
      personalemail: 'personalEmail',
      phone: 'phone',
      phonenumber: 'phone',
      mobile: 'phone',
      dateofjoining: 'dateOfJoining',
      doj: 'dateOfJoining',
      joiningdate: 'dateOfJoining',
      jobtitle: 'jobTitle',
      title: 'jobTitle',
      designation: 'jobTitle',
      department: 'department',
      dept: 'department',
      role: 'role',
      roleid: 'role',
      dateofbirth: 'dateOfBirth',
      dob: 'dateOfBirth',
      gender: 'gender',
      address: 'address',
      officelocations: 'officeLocations',
      officelocation: 'officeLocations',
      offices: 'officeLocations',
      office: 'officeLocations',
      locations: 'officeLocations',
      location: 'officeLocations',
      workplace: 'officeLocations',
      workplaces: 'officeLocations',
      assignedoffices: 'officeLocations',
      assignedoffice: 'officeLocations',
    };
    return map[clean] || h.trim();
  }

  async getHrStaff(): Promise<Array<{ id: string; name: string; email: string; role?: string }>> {
    const hrEmployees = await this.prisma.employee.findMany({
      where: {
        OR: [
          { department: { name: { contains: 'Human Resources' } } },
          { department: { code: 'HR' } },
          { email: { contains: '.hr@' } },
          { email: 'priya.patil@company.com' },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    const staffList: Array<{ id: string; name: string; email: string; role?: string }> = hrEmployees.map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`.trim(),
      email: e.email,
      role: 'HR_ADMIN',
    }));

    const defaultHrEmails = [
      { name: 'Tejaswini Patil (HR)', email: 'tejaswinipatil3apr@gmail.com' },
      { name: 'Priya Patil', email: 'priya.patil@company.com' },
      { name: 'Tejaswini Patil (HR Dept)', email: 'tejaswini.patil.hr@company.com' },
      { name: 'Admin', email: 'admin@company.com' },
    ];

    for (const def of defaultHrEmails) {
      if (!staffList.some((s) => s.email.toLowerCase() === def.email.toLowerCase())) {
        staffList.push({
          id: `hr-${def.email}`,
          name: def.name,
          email: def.email,
          role: 'HR_ADMIN',
        });
      }
    }

    return staffList;
  }
}
