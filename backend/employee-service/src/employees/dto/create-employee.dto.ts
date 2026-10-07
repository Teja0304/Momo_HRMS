import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentStatus } from '@prisma/client';
import {
  IsArray,
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

  @ApiPropertyOptional({ description: 'Office location ID (alias for primaryOfficeId)' })
  @IsOptional()
  @IsString()
  officeLocationId?: string;

  @ApiPropertyOptional({ description: 'Office location name' })
  @IsOptional()
  @IsString()
  officeLocationName?: string;

  @ApiPropertyOptional({ description: 'List of office IDs or Codes the employee is assigned to work at', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  officeIds?: string[];

  @ApiPropertyOptional({ description: 'Personal email for credentials delivery' })
  @IsOptional()
  @IsString()
  personalEmail?: string;

  @ApiPropertyOptional({ description: 'Job title / Designation name' })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'Assigned Role UUID or name' })
  @IsOptional()
  @IsString()
  roleId?: string;

  @ApiPropertyOptional({ description: 'Automatically provision auth user account' })
  @IsOptional()
  provisionAccount?: boolean;

  @ApiPropertyOptional({ description: 'Date of birth' })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Gender' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: 'Residential address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Profile photo URL' })
  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;

  @ApiPropertyOptional({ description: 'Employment type: EMPLOYEE or INTERN' })
  @IsOptional()
  @IsString()
  employmentType?: string;
}
