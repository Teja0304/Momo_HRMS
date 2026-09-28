import { z } from 'zod';
import { text, reasonField } from '../../utils/fields';
import { paginationShape } from '../../utils/pagination';

const codeField = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{2,20}$/, 'Department code must be 2-20 characters: letters, numbers, - or _');

export const createDepartmentSchema = z.strictObject({
  name: text(100),
  code: codeField,
  description: text(500).optional(),
});

export const updateDepartmentSchema = z.strictObject({
  name: text(100).optional(),
  code: codeField.optional(),
  description: text(500).nullable().optional(),
});

export const departmentStatusSchema = z.strictObject({
  status: z.enum(['ACTIVE', 'INACTIVE']),
  reason: reasonField.optional(),
});

export const listDepartmentsQuerySchema = z.object({
  ...paginationShape,
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  search: text(255, 1).optional(),
});

export const listDepartmentEmployeesQuerySchema = z.object(paginationShape);
