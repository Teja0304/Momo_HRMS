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
    return this.prisma.department.findMany({
      include: { designations: true },
      orderBy: { name: 'asc' },
    });
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
}
