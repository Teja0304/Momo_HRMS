import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRoles } from '../../middleware/authorize';
import { ROLE_NAMES } from '../../utils/roles';
import * as controller from './device.controller';

const manage = requireRoles(ROLE_NAMES.HR_ADMIN, ROLE_NAMES.SUPER_ADMIN);

/** Mounted at {API_PREFIX}/employees so the final paths are /employees/:id/devices */
export const employeeDevicesRouter = Router();
employeeDevicesRouter.post('/:id/devices', authenticate, manage, controller.registerDevice);
employeeDevicesRouter.get('/:id/devices', authenticate, manage, controller.listEmployeeDevices);

/** Mounted at {API_PREFIX}/devices */
export const devicesRouter = Router();
devicesRouter.get('/', authenticate, manage, controller.listDevices);
devicesRouter.get('/:id', authenticate, manage, controller.getDevice);
devicesRouter.patch('/:id', authenticate, manage, controller.updateDevice);
devicesRouter.patch('/:id/status', authenticate, manage, controller.changeDeviceStatus);
