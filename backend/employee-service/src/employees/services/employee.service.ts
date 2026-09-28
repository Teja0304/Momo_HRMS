import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCodes } from '../../common/constants/error-codes';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { AssignOfficeDto } from '../dto/assign-office.dto';
import { EmployeeQueryDto } from '../dto/employee-query.dto';
import { EmploymentStatus, Prisma } from '@prisma/client';

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          employeeCode: dto.employeeCode,
          userId: dto.userId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          departmentId: dto.departmentId,
          designationId: dto.designationId,
          employmentStatus: dto.employmentStatus ?? EmploymentStatus.ACTIVE,
          dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : new Date(),
        },
      });

      if (dto.primaryOfficeId) {
        await tx.employeeOfficeAssignment.create({
          data: {
            employeeId: employee.id,
            officeId: dto.primaryOfficeId,
            isPrimary: true,
            isActive: true,
          },
        });
      }

      this.logger.log(`Created employee ${employee.employeeCode} (${employee.email})`);
      return tx.employee.findUniqueOrThrow({
        where: { id: employee.id },
        include: {
          department: true,
          designation: true,
          assignments: { where: { isActive: true } },
        },
      });
    });
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

    return this.prisma.employee.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        departmentId: dto.departmentId,
        designationId: dto.designationId,
        employmentStatus: dto.employmentStatus,
        dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : undefined,
        userId: dto.userId,
      },
      include: {
        department: true,
        designation: true,
        assignments: { where: { isActive: true } },
      },
    });
  }

  /**
   * List employees with filtering and pagination.
   */
  async listEmployees(query: EmployeeQueryDto) {
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
      items,
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

    return employee;
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

    return employee;
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
    const employee = await this.prisma.employee.findFirst({
      where: {
        OR: [{ id: employeeIdOrCode }, { employeeCode: employeeIdOrCode }],
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });

    if (!employee) {
      this.logger.warn(`isAssignedToOffice: Employee ${employeeIdOrCode} not found or not active.`);
      return false;
    }

    const assignment = await this.prisma.employeeOfficeAssignment.findFirst({
      where: {
        employeeId: employee.id,
        officeId,
        isActive: true,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
    });

    const isAssigned = !!assignment;
    this.logger.log(`Assignment check for employee=${employee.employeeCode} office=${officeId} -> ${isAssigned}`);
    return isAssigned;
  }
}
