import type { Prisma } from '@prisma/client';
import type { Db } from '../lib/prisma';

export type AuditAction =
  | 'EMPLOYEE_CREATED'
  | 'EMPLOYEE_UPDATED'
  | 'EMPLOYEE_STATUS_CHANGED'
  | 'EMPLOYEE_ROLE_CHANGED'
  | 'DEPARTMENT_CREATED'
  | 'DEPARTMENT_UPDATED'
  | 'DEPARTMENT_STATUS_CHANGED'
  | 'DEVICE_REGISTERED'
  | 'DEVICE_UPDATED'
  | 'DEVICE_STATUS_CHANGED'
  | 'FACE_TEMPLATE_REGISTERED'
  | 'FACE_TEMPLATE_REPLACED'
  | 'FACE_TEMPLATE_STATUS_CHANGED';

export type AuditEntity = 'EMPLOYEE' | 'DEPARTMENT' | 'DEVICE' | 'FACE_TEMPLATE';

interface AuditEntry {
  actorUserId: string | null;
  action: AuditAction;
  entityType: AuditEntity;
  entityId: string;
  /** Only ids, field names and status values. Never passwords, tokens or biometric data. */
  metadata?: Prisma.InputJsonValue;
}

/** Call this with the SAME transaction client (tx) as the change it describes. */
export async function writeAudit(db: Db, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      actorUserId: entry.actorUserId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
    },
  });
}
