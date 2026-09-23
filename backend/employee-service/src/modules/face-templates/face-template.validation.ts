import { z } from 'zod';
import { text } from '../../utils/fields';

const templateStatusEnum = z.enum(['ACTIVE', 'REVOKED', 'EXPIRED']);

export const registerFaceTemplateSchema = z.strictObject({
  externalReferenceId: text(255),
  provider: text(100),
  expiresAt: z.iso.datetime({ error: 'expiresAt must be an ISO-8601 date-time' }).optional(),
});

export const faceTemplateStatusSchema = z.strictObject({
  status: templateStatusEnum,
});
