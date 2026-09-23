import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRoles } from '../../middleware/authorize';
import { ROLE_NAMES } from '../../utils/roles';
import * as controller from './employee.controller';

const router = Router();
const manage = requireRoles(ROLE_NAMES.HR_ADMIN, ROLE_NAMES.SUPER_ADMIN);

// Listing and creation are admin/HR-only. Reading a single employee or their
// profile is also open to the employee themself (enforced in the service via
// assertAdminOrSelf), so those two only require a valid login, not a role.
router.get('/', authenticate, manage, controller.listEmployees);
router.post('/', authenticate, manage, controller.createEmployee);
router.get('/:id', authenticate, controller.getEmployee);
router.get('/:id/profile', authenticate, controller.getEmployeeProfile);
router.put('/:id', authenticate, manage, controller.updateEmployee);
router.patch('/:id/status', authenticate, manage, controller.changeEmployeeStatus);

export default router;
