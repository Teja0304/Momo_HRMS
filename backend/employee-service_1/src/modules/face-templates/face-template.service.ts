import { TemplateStatus } from '@prisma/client';
import { prisma, lockEmployee } from '../../lib/prisma';
import { conflict, notFound } from '../../utils/errors';
import { toFaceTemplateDto, isTemplateLive } from '../../utils/serializers';
import { writeAudit } from '../../utils/audit';
import type { AuthUser } from '../../utils/roles';

async function findEmployeeOrThrow(employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
  return employee;
}

/**
 * Registers a face-template reference for an employee. If the employee already
 * has an ACTIVE reference, that old one is revoked first and the new one
 * becomes the active reference — this is how a reference is "replaced".
 */
export async function registerOrReplaceFaceTemplate(
  employeeId: string,
  input: { externalReferenceId: string; provider: string; expiresAt?: string },
  actor: AuthUser,
) {
  await findEmployeeOrThrow(employeeId);

  const duplicate = await prisma.faceTemplateReference.findUnique({
    where: { provider_externalReferenceId: { provider: input.provider, externalReferenceId: input.externalReferenceId } },
  });
  if (duplicate) throw conflict('FACE_TEMPLATE_REFERENCE_TAKEN', 'This external reference is already registered for this provider');

  const template = await prisma.$transaction(async (tx) => {
    await lockEmployee(tx, employeeId);

    const currentActive = await tx.faceTemplateReference.findFirst({ where: { employeeId, status: 'ACTIVE' } });
    let action: 'FACE_TEMPLATE_REGISTERED' | 'FACE_TEMPLATE_REPLACED' = 'FACE_TEMPLATE_REGISTERED';

    if (currentActive) {
      action = 'FACE_TEMPLATE_REPLACED';
      await tx.faceTemplateReference.update({
        where: { id: currentActive.id },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
    }

    const created = await tx.faceTemplateReference.create({
      data: {
        employeeId,
        externalReferenceId: input.externalReferenceId,
        provider: input.provider,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });

    await writeAudit(tx, {
      actorUserId: actor.id,
      action,
      entityType: 'FACE_TEMPLATE',
      entityId: created.id,
      metadata: { employeeId, provider: created.provider, replacedTemplateId: currentActive?.id ?? null },
    });

    return created;
  });

  return toFaceTemplateDto(template);
}

export async function getEmployeeFaceTemplateStatus(employeeId: string) {
  await findEmployeeOrThrow(employeeId);

  const latest = await prisma.faceTemplateReference.findFirst({
    where: { employeeId },
    orderBy: { enrolledAt: 'desc' },
  });

  return {
    employeeId,
    hasActiveReference: latest !== null && isTemplateLive(latest),
    reference: latest ? toFaceTemplateDto(latest) : null,
  };
}

export async function changeFaceTemplateStatus(id: string, status: TemplateStatus, actor: AuthUser) {
  const template = await prisma.faceTemplateReference.findUnique({ where: { id } });
  if (!template) throw notFound('FACE_TEMPLATE_NOT_FOUND', 'Face-template reference not found');

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.faceTemplateReference.update({
      where: { id },
      data: { status, revokedAt: status === 'REVOKED' ? new Date() : template.revokedAt },
    });
    await writeAudit(tx, {
      actorUserId: actor.id,
      action: 'FACE_TEMPLATE_STATUS_CHANGED',
      entityType: 'FACE_TEMPLATE',
      entityId: id,
      metadata: { from: template.status, to: status },
    });
    return result;
  });

  return toFaceTemplateDto(updated);
}

/** DELETE /face-templates/:id revokes the reference; it never erases audit history. */
export async function revokeFaceTemplate(id: string, actor: AuthUser) {
  const template = await prisma.faceTemplateReference.findUnique({ where: { id } });
  if (!template) throw notFound('FACE_TEMPLATE_NOT_FOUND', 'Face-template reference not found');

  if (template.status === 'REVOKED') {
    return toFaceTemplateDto(template);
  }

  return changeFaceTemplateStatus(id, 'REVOKED', actor);
}
