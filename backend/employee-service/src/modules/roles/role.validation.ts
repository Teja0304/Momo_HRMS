import { z } from 'zod';
import { uuid } from '../../utils/fields';
import { paginationShape } from '../../utils/pagination';

export const changeEmployeeRoleSchema = z.strictObject({
  roleId: uuid('roleId'),
});

export const listEmployeesByRoleQuerySchema = z.object(paginationShape);
