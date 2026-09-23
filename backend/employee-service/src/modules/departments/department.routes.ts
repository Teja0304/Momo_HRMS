import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRoles } from '../../middleware/authorize';
import { ROLE_NAMES } from '../../utils/roles';
import * as controller from './department.controller';

const router = Router();
const manage = requireRoles(ROLE_NAMES.HR_ADMIN, ROLE_NAMES.SUPER_ADMIN);

// Any authenticated user can browse departments; only HR/Super admins can manage them.
router.get('/', authenticate, controller.listDepartments);
router.get('/:id', authenticate, controller.getDepartment);
router.get('/:id/employees', authenticate, manage, controller.listDepartmentEmployees);
router.post('/', authenticate, manage, controller.createDepartment);
router.put('/:id', authenticate, manage, controller.updateDepartment);
router.patch('/:id/status', authenticate, manage, controller.changeDepartmentStatus);

export default router;
