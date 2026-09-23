import { EmploymentStatus, Prisma } from '@prisma/client';
import { prisma, lockEmployee } from '../../lib/prisma';
import { conflict, notFound } from '../../utils/errors';
import { buildMeta, toSkipTake } from '../../utils/pagination';
import { employeeInclude, toEmployeeDto, isTemplateLive } from '../../utils/serializers';
import { canTransition, EMPLOYEE_TRANSITIONS } from '../../utils/transitions';
import { writeAudit } from '../../utils/audit';
import { assertAdminOrSelf, assertCanManageTarget, assertNotSelf, isAdmin, type AuthUser } from '../../utils/roles';

async function findEmployeeWithRelationsOrThrow(id: string) {
  const employee = await prisma.employee.findUnique({ where: { id }, include: employeeInclude });
  if (!employee) throw notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
  return employee;
}

async function assertDepartmentIsUsable(departmentId: string): Promise<void> {
  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) throw notFound('DEPARTMENT_NOT_FOUND', 'Department not found');
  if (department.status !== 'ACTIVE') {
    throw conflict('DEPARTMENT_INACTIVE', 'Cannot assign an employee to an inactive department');
  }
}

async function assertRoleExists(roleId: string): Promise<void> {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw notFound('ROLE_NOT_FOUND', 'Role not found');
}

interface ListEmployeesQuery {
  page: number;
  limit: number;
  search?: string;
  departmentId?: string;
  roleId?: string;
  status?: EmploymentStatus;
}

export async function listEmployees(query: ListEmployeesQuery) {
  const where: Prisma.EmployeeWhereInput = {
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.roleId ? { roleId: query.roleId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: query.search } },
            { lastName: { contains: query.search } },
            { employeeCode: { contains: query.search } },
            { email: { contains: query.search } },
          ],
        }
      : {}),
  };

  const { skip, take } = toSkipTake(query.page, query.limit);
  const [rows, total] = await prisma.$transaction([
    prisma.employee.findMany({ where, skip, take, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], include: employeeInclude }),
    prisma.employee.count({ where }),
  ]);

  return { data: rows.map((row) => toEmployeeDto(row, { admin: true })), meta: buildMeta(query.page, query.limit, total) };
}

export async function getEmployeeById(id: string, actor: AuthUser) {
  const employee = await findEmployeeWithRelationsOrThrow(id);
  assertAdminOrSelf(actor, employee);
  return toEmployeeDto(employee, { admin: isAdmin(actor) });
}

export async function getEmployeeProfile(id: string, actor: AuthUser) {
  const employee = await findEmployeeWithRelationsOrThrow(id);
  assertAdminOrSelf(actor, employee);

  const [devices, latestFaceTemplate] = await Promise.all([
    prisma.employeeDevice.findMany({ where: { employeeId: id }, orderBy: { registeredAt: 'desc' } }),
    prisma.faceTemplateReference.findFirst({ where: { employeeId: id }, orderBy: { enrolledAt: 'desc' } }),
  ]);

  return {
    employee: toEmployeeDto(employee, { admin: isAdmin(actor) }),
    devices: devices.map((device) => ({ id: device.id, deviceName: device.deviceName, deviceType: device.deviceType, status: device.status })),
    faceTemplate: {
      hasActiveReference: latestFaceTemplate !== null && isTemplateLive(latestFaceTemplate),
      status: latestFaceTemplate?.status ?? null,
    },
  };
}

interface CreateEmployeeInput {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth?: Date;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
  address?: string;
  profilePhotoUrl?: string;
  dateOfJoining: Date;
  jobTitle: string;
  departmentId: string;
  roleId: string;
  userId?: string;
}

export async function createEmployee(input: CreateEmployeeInput, actor: AuthUser) {
  await assertDepartmentIsUsable(input.departmentId);
  await assertRoleExists(input.roleId);

  const clash = await prisma.employee.findFirst({
    where: {
      OR: [{ employeeCode: input.employeeCode }, { email: input.email }, ...(input.userId ? [{ userId: input.userId }] : [])],
    },
  });
  if (clash) {
    const field = clash.employeeCode === input.employeeCode ? 'employeeCode' : clash.email === input.email ? 'email' : 'userId';
    throw conflict('EMPLOYEE_DUPLICATE', `An employee with the same ${field} already exists`, { field });
  }

  const employee = await prisma.$transaction(async (tx) => {
    const created = await tx.employee.create({ data: input, include: employeeInclude });
    await writeAudit(tx, {
      actorUserId: actor.id,
      action: 'EMPLOYEE_CREATED',
      entityType: 'EMPLOYEE',
      entityId: created.id,
      metadata: { employeeCode: created.employeeCode, departmentId: created.departmentId, roleId: created.roleId },
    });
    return created;
  });

  return toEmployeeDto(employee, { admin: true });
}

interface UpdateEmployeeInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: Date | null;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY' | null;
  address?: string | null;
  profilePhotoUrl?: string | null;
  jobTitle?: string;
  departmentId?: string;
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput, actor: AuthUser) {
  const current = await findEmployeeWithRelationsOrThrow(id);
  assertCanManageTarget(actor, current.role.name);

  if (input.departmentId) {
    await assertDepartmentIsUsable(input.departmentId);
  }
  if (input.email) {
    const clash = await prisma.employee.findFirst({ where: { id: { not: id }, email: input.email } });
    if (clash) throw conflict('EMPLOYEE_DUPLICATE', 'An employee with the same email already exists', { field: 'email' });
  }

  const employee = await prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({ where: { id }, data: input, include: employeeInclude });
    await writeAudit(tx, {
      actorUserId: actor.id,
      action: 'EMPLOYEE_UPDATED',
      entityType: 'EMPLOYEE',
      entityId: id,
      metadata: { fields: Object.keys(input) },
    });
    return updated;
  });

  return toEmployeeDto(employee, { admin: true });
}

const DEACTIVATING_STATUSES: readonly EmploymentStatus[] = ['INACTIVE', 'TERMINATED'];

export async function changeEmployeeStatus(id: string, status: EmploymentStatus, reason: string | undefined, actor: AuthUser) {
  const employee = await prisma.$transaction(async (tx) => {
    await lockEmployee(tx, id);
    const current = await tx.employee.findUnique({ where: { id }, include: { role: true } });
    if (!current) throw notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');

    assertNotSelf(actor, current, 'change employment status');
    assertCanManageTarget(actor, current.role.name);

    if (current.status === status) {
      return tx.employee.findUniqueOrThrow({ where: { id }, include: employeeInclude });
    }
    if (!canTransition(EMPLOYEE_TRANSITIONS, current.status, status)) {
      throw conflict('INVALID_STATUS_TRANSITION', `Cannot change employee status from ${current.status} to ${status}`);
    }

    const isDeactivating = DEACTIVATING_STATUSES.includes(status);
    const updated = await tx.employee.update({
      where: { id },
      data: {
        status,
        deactivatedAt: isDeactivating ? new Date() : null,
        deactivationReason: isDeactivating ? (reason ?? null) : null,
        deactivatedBy: isDeactivating ? actor.id : null,
      },
      include: employeeInclude,
    });

    await writeAudit(tx, {
      actorUserId: actor.id,
      action: 'EMPLOYEE_STATUS_CHANGED',
      entityType: 'EMPLOYEE',
      entityId: id,
      metadata: { from: current.status, to: status, reason: reason ?? null },
    });

    return updated;
  });

  return toEmployeeDto(employee, { admin: true });
}
