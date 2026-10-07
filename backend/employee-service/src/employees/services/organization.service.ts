import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCodes } from '../../common/constants/error-codes';
import { CreateDepartmentDto } from '../dto/department.dto';
import { CreateDesignationDto } from '../dto/designation.dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async listDepartments() {
    const departments = await this.prisma.department.findMany({
      include: {
        designations: true,
        _count: { select: { employees: true } },
      },
      orderBy: { name: 'asc' },
    });

    return departments.map((d: any) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      description: d.description,
      status: 'ACTIVE',
      employeeCount: d._count?.employees ?? 0,
      createdAt: d.createdAt?.toISOString?.() ?? d.createdAt,
      updatedAt: d.updatedAt?.toISOString?.() ?? d.updatedAt,
      designations: d.designations,
    }));
  }

  async createDepartment(dto: CreateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new AppException(
        ErrorCodes.VALIDATION_FAILED,
        `Department with code ${dto.code} already exists`,
        HttpStatus.CONFLICT,
      );
    }

    return this.prisma.department.create({ data: dto });
  }

  async listDesignations(departmentId?: string) {
    return this.prisma.designation.findMany({
      where: departmentId ? { departmentId } : {},
      include: { department: true },
      orderBy: { title: 'asc' },
    });
  }

  async createDesignation(dto: CreateDesignationDto) {
    const existing = await this.prisma.designation.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new AppException(
        ErrorCodes.VALIDATION_FAILED,
        `Designation with code ${dto.code} already exists`,
        HttpStatus.CONFLICT,
      );
    }

    return this.prisma.designation.create({ data: dto });
  }

  async listRoles() {
    return [
      { id: 'role-super-admin', name: 'SUPER_ADMIN', description: 'Full administrative access across the system', employeeCount: 1 },
      { id: 'role-hr-admin', name: 'HR_ADMIN', description: 'Manages employees, departments, devices and face-template references', employeeCount: 1 },
      { id: 'role-manager', name: 'MANAGER', description: 'Manages a team within a department (no system administration rights)', employeeCount: 0 },
      { id: 'role-employee', name: 'EMPLOYEE', description: 'Standard employee with access to their own record', employeeCount: 1 },
    ];
  }
}

