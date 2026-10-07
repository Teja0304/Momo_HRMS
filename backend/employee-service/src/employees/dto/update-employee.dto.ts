import { ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentStatus } from '@prisma/client';
import { IsArray, IsDateString, IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ description: 'Employee first name' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Employee last name' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  lastName?: string;

  @ApiPropertyOptional({ description: 'Official email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
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

  @ApiPropertyOptional({ enum: EmploymentStatus })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @ApiPropertyOptional({ description: 'Date of joining (ISO-8601)' })
  @IsOptional()
  @IsDateString()
  dateOfJoining?: string;

  @ApiPropertyOptional({ description: 'Associated auth user ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Personal email' })
  @IsOptional()
  @IsString()
  personalEmail?: string;

  @ApiPropertyOptional({ description: 'Job title' })
  @IsOptional()
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional({ description: 'Role ID' })
  @IsOptional()
  @IsString()
  roleId?: string;

  @ApiPropertyOptional({ description: 'Primary office ID or Code to assign', example: 'OFFICE-001' })
  @IsOptional()
  @IsString()
  primaryOfficeId?: string;

  @ApiPropertyOptional({ description: 'Office location ID' })
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

  @ApiPropertyOptional({ description: 'Date of birth' })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Gender' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: 'Address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Permanent address' })
  @IsOptional()
  @IsString()
  permanentAddress?: string;

  @ApiPropertyOptional({ description: 'Alternate phone number' })
  @IsOptional()
  @IsString()
  alternatePhone?: string;

  @ApiPropertyOptional({ description: 'Emergency contact name' })
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiPropertyOptional({ description: 'Emergency contact relationship' })
  @IsOptional()
  @IsString()
  emergencyContactRelation?: string;

  @ApiPropertyOptional({ description: 'Emergency contact phone' })
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ description: 'Is onboarding completed' })
  @IsOptional()
  isOnboarded?: boolean;

  @ApiPropertyOptional({ description: 'Profile photo URL' })
  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;
}
