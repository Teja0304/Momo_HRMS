import { z } from 'zod';
import { uuid, text, emailField, phoneField, dateOnly, httpUrl, reasonField } from '../../utils/fields';
import { paginationShape } from '../../utils/pagination';

const genderEnum = z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']);
const employmentStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED']);

const employeeCodeField = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{2,30}$/, 'Employee code must be 2-30 characters: letters, numbers or -');

export const createEmployeeSchema = z.strictObject({
  employeeCode: employeeCodeField,
  firstName: text(100),
  lastName: text(100),
  email: emailField,
  phone: phoneField,
  dateOfBirth: dateOnly.optional(),
  gender: genderEnum.optional(),
  address: text(500).optional(),
  profilePhotoUrl: httpUrl.optional(),
  dateOfJoining: dateOnly,
  jobTitle: text(150),
  departmentId: uuid('departmentId'),
  roleId: uuid('roleId'),
  // Optional link to an existing login account created by the auth-service.
  userId: uuid('userId').optional(),
});

export const updateEmployeeSchema = z.strictObject({
  firstName: text(100).optional(),
  lastName: text(100).optional(),
  email: emailField.optional(),
  phone: phoneField.optional(),
  dateOfBirth: dateOnly.nullable().optional(),
  gender: genderEnum.nullable().optional(),
  address: text(500).nullable().optional(),
  profilePhotoUrl: httpUrl.nullable().optional(),
  jobTitle: text(150).optional(),
  departmentId: uuid('departmentId').optional(),
});

export const employeeStatusSchema = z.strictObject({
  status: employmentStatusEnum,
  reason: reasonField.optional(),
});

export const listEmployeesQuerySchema = z.object({
  ...paginationShape,
  search: text(255, 1).optional(),
  departmentId: uuid('departmentId').optional(),
  roleId: uuid('roleId').optional(),
  status: employmentStatusEnum.optional(),
});
