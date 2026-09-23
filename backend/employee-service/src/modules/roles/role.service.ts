import { prisma, lockEmployee } from '../../lib/prisma';
import { notFound } from '../../utils/errors';
import { buildMeta, toSkipTake } from '../../utils/pagination';
import { toRoleDto, toEmployeeDto, employeeInclude } from '../../utils/serializers';
import { writeAudit } from '../../utils/audit';
import { assertCanManageTarget, assertNotSelf, type AuthUser } from '../../utils/roles';
import { authServiceClient } from '../../integrations/auth-service.client';

export async function listRoles() {
  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { employees: true } } },
  });
  return roles.map((role) => toRoleDto(role, role._count.employees));
}

export async function getRoleById(id: string) {
  const role = await prisma.role.findUnique({ where: { id }, include: { _count: { select: { employees: true } } } });
  if (!role) throw notFound('ROLE_NOT_FOUND', 'Role not found');
  return toRoleDto(role, role._count.employees);
}

export async function listEmployeesByRole(roleId: string, query: { page: number; limit: number }) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw notFound('ROLE_NOT_FOUND', 'Role not found');

  const { skip, take } = toSkipTake(query.page, query.limit);
  const [rows, total] = await prisma.$transaction([
    prisma.employee.findMany({ where: { roleId }, skip, take, orderBy: [{ lastName: 'asc' }], include: employeeInclude }),
    prisma.employee.count({ where: { roleId } }),
  ]);

  return { data: rows.map((row) => toEmployeeDto(row, { admin: true })), meta: buildMeta(query.page, query.limit, total) };
}

/**
 * Changes which Role an employee has in this service, and — when the employee
 * has a linked login account and AUTH_SERVICE_URL is configured — asks the
 * auth-service to update that account's login roles too, so both stay in sync.
 */
export async function changeEmployeeRole(employeeId: string, newRoleId: string, actor: AuthUser) {
  const newRole = await prisma.role.findUnique({ where: { id: newRoleId } });
  if (!newRole) throw notFound('ROLE_NOT_FOUND', 'Role not found');

  const employee = await prisma.$transaction(async (tx) => {
    await lockEmployee(tx, employeeId);
    const current = await tx.employee.findUnique({ where: { id: employeeId }, include: { role: true } });
    if (!current) throw notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');

    assertNotSelf(actor, current, 'change your role');
    assertCanManageTarget(actor, current.role.name);
    assertCanManageTarget(actor, newRole.name);

    if (current.roleId === newRoleId) {
      return tx.employee.findUniqueOrThrow({ where: { id: employeeId }, include: employeeInclude });
    }

    const updated = await tx.employee.update({ where: { id: employeeId }, data: { roleId: newRoleId }, include: employeeInclude });
    await writeAudit(tx, {
      actorUserId: actor.id,
      action: 'EMPLOYEE_ROLE_CHANGED',
      entityType: 'EMPLOYEE',
      entityId: employeeId,
      metadata: { from: current.role.name, to: newRole.name },
    });
    return updated;
  });

  // Best-effort sync with the auth-service login roles. If this fails we do not
  // roll back the employee-service change (the two systems reconcile on next sync),
  // but the caller sees the failure and knows to retry the sync.
  if (authServiceClient.isEnabled && employee.userId) {
    await authServiceClient.setUserRoles(employee.userId, [newRole.name], actor.accessToken);
  }

  return toEmployeeDto(employee, { admin: true });
}
