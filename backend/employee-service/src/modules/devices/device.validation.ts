import { z } from 'zod';
import { text } from '../../utils/fields';
import { paginationShape } from '../../utils/pagination';

const deviceTypeEnum = z.enum(['ANDROID', 'IOS', 'WEB', 'OTHER']);
const deviceStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'REVOKED']);

export const registerDeviceSchema = z.strictObject({
  deviceName: text(100),
  deviceType: deviceTypeEnum,
  // Public hardware/installation identifier only. Never a password or secret token.
  deviceIdentifier: text(255),
});

export const updateDeviceSchema = z.strictObject({
  deviceName: text(100).optional(),
  deviceType: deviceTypeEnum.optional(),
});

export const deviceStatusSchema = z.strictObject({
  status: deviceStatusEnum,
});

export const listDevicesQuerySchema = z.object({
  ...paginationShape,
  status: deviceStatusEnum.optional(),
  deviceType: deviceTypeEnum.optional(),
});

export const listEmployeeDevicesQuerySchema = z.object({
  ...paginationShape,
  status: deviceStatusEnum.optional(),
});
