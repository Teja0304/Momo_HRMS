import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentStatus } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty({ description: 'Unique employee company code', example: 'EMP-002' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  employeeCode!: string;

  @ApiPropertyOptional({ description: 'External Auth Service User UUID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: 'Employee first name', example: 'Sarah' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  firstName!: string;

  @ApiProperty({ description: 'Employee last name', example: 'Connor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  lastName!: string;

  @ApiProperty({ description: 'Official email address', example: 'sarah.connor@company.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+91 9123456780' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional({ description: 'Department UUID' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Designation UUID' })
  @IsOptional()
  @IsString()
  designationId?: string;

  @ApiPropertyOptional({ enum: EmploymentStatus, default: EmploymentStatus.ACTIVE })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @ApiPropertyOptional({ description: 'Date of joining (ISO-8601)', example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  dateOfJoining?: string;

  @ApiPropertyOptional({ description: 'Primary office ID or Code to assign', example: 'OFFICE-001' })
  @IsOptional()
  @IsString()
  primaryOfficeId?: string;
}
