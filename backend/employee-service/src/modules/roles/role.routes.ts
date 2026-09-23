import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRoles } from '../../middleware/authorize';
import { ROLE_NAMES } from '../../utils/roles';
import * as controller from './role.controller';

const manage = requireRoles(ROLE_NAMES.HR_ADMIN, ROLE_NAMES.SUPER_ADMIN);

/** Mounted at {API_PREFIX}/roles */
export const rolesRouter = Router();
rolesRouter.get('/', authenticate, controller.listRoles);
rolesRouter.get('/:id', authenticate, controller.getRole);
rolesRouter.get('/:id/employees', authenticate, manage, controller.listEmployeesByRole);

/** Mounted at {API_PREFIX}/employees so the final path is PATCH /employees/:id/role */
export const employeeRoleRouter = Router();
employeeRoleRouter.patch('/:id/role', authenticate, manage, controller.changeEmployeeRole);
