import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/authenticate';
import { requireRoles } from '../../middleware/authorize';
import { ROLE_NAMES } from '../../utils/roles';
import * as controller from './employee.controller';

const router = Router();
const manage = requireRoles(ROLE_NAMES.HR_ADMIN, ROLE_NAMES.SUPER_ADMIN);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Listing and creation are admin/HR-only.
router.get('/', authenticate, manage, controller.listEmployees);
router.post('/', authenticate, manage, controller.createEmployee);

// Bulk Import endpoints (must be defined BEFORE :id)
router.get('/import/template', authenticate, manage, controller.downloadImportTemplate);
router.post('/import/validate', authenticate, manage, upload.single('file'), controller.validateImport);
router.post('/import', authenticate, manage, upload.single('file'), controller.executeImport);

// Single employee management
router.post('/:id/resend-credentials', authenticate, manage, controller.resendCredentials);
router.get('/:id', authenticate, controller.getEmployee);
router.get('/:id/profile', authenticate, controller.getEmployeeProfile);
router.put('/:id', authenticate, manage, controller.updateEmployee);
router.patch('/:id/status', authenticate, manage, controller.changeEmployeeStatus);

export default router;
