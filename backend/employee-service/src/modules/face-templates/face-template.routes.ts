import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRoles } from '../../middleware/authorize';
import { ROLE_NAMES } from '../../utils/roles';
import * as controller from './face-template.controller';

const manage = requireRoles(ROLE_NAMES.HR_ADMIN, ROLE_NAMES.SUPER_ADMIN);

/** Mounted at {API_PREFIX}/employees so the final paths are /employees/:id/face-template */
export const employeeFaceTemplateRouter = Router();
employeeFaceTemplateRouter.post('/:id/face-template', authenticate, manage, controller.registerFaceTemplate);
employeeFaceTemplateRouter.get('/:id/face-template', authenticate, manage, controller.getEmployeeFaceTemplateStatus);

/** Mounted at {API_PREFIX}/face-templates */
export const faceTemplatesRouter = Router();
faceTemplatesRouter.patch('/:id/status', authenticate, manage, controller.changeFaceTemplateStatus);
faceTemplatesRouter.delete('/:id', authenticate, manage, controller.revokeFaceTemplate);
