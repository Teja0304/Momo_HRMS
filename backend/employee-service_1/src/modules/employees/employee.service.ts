import crypto from 'node:crypto';
import { EmploymentStatus, Prisma } from '@prisma/client';
import { prisma, lockEmployee } from '../../lib/prisma';
import { conflict, notFound } from '../../utils/errors';
import { buildMeta, toSkipTake } from '../../utils/pagination';
import { employeeInclude, toEmployeeDto, isTemplateLive } from '../../utils/serializers';
import { canTransition, EMPLOYEE_TRANSITIONS } from '../../utils/transitions';
import { writeAudit } from '../../utils/audit';
import { assertAdminOrSelf, assertCanManageTarget, assertNotSelf, isAdmin, type AuthUser, ROLE_NAMES } from '../../utils/roles';
import { authServiceClient } from '../../integrations/auth-service.client';
import { emailService } from '../email/email.service';

function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let pwd = '';
  const bytes = crypto.randomBytes(10);
  for (let i = 0; i < 10; i++) {
    const byte = bytes[i] ?? 0;
    pwd += chars[byte % chars.length];
  }
  return pwd + 'A1!';
}

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
            { personalEmail: { contains: query.search } },
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
  personalEmail?: string;
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
  provisionAccount?: boolean;
}

export async function createEmployee(input: CreateEmployeeInput, actor: AuthUser) {
  await assertDepartmentIsUsable(input.departmentId);
  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw notFound('ROLE_NOT_FOUND', 'Role not found');
  assertCanManageTarget(actor, role.name);

  const clash = await prisma.employee.findFirst({
    where: {
      OR: [{ employeeCode: input.employeeCode }, { email: input.email }, ...(input.userId ? [{ userId: input.userId }] : [])],
    },
  });
  if (clash) {
    const field = clash.employeeCode === input.employeeCode ? 'employeeCode' : clash.email === input.email ? 'email' : 'userId';
    throw conflict('EMPLOYEE_DUPLICATE', `An employee with the same ${field} already exists`, { field });
  }

  let createdAuthUserId = input.userId;
  let temporaryPassword: string | undefined;
  let generatedUsername: string | undefined;
  let targetAuthRole: string = ROLE_NAMES.EMPLOYEE;

  // Account Provisioning (Case B)
  if (!createdAuthUserId && input.provisionAccount !== false && authServiceClient.isEnabled) {
    temporaryPassword = generateTemporaryPassword();
    targetAuthRole =
      role.name === ROLE_NAMES.SUPER_ADMIN
        ? ROLE_NAMES.SUPER_ADMIN
        : role.name === ROLE_NAMES.HR_ADMIN
        ? ROLE_NAMES.HR_ADMIN
        : ROLE_NAMES.EMPLOYEE;

    const rawUsername = input.employeeCode.toLowerCase().replace(/[^a-zA-Z0-9._-]/g, '_');
    generatedUsername = rawUsername.length >= 3 ? rawUsername : `emp_${rawUsername}`;

    const authUser = await authServiceClient.createUser(
      {
        email: input.email,
        username: generatedUsername,
        fullName: `${input.firstName} ${input.lastName}`,
        password: temporaryPassword,
        roles: [targetAuthRole],
      },
      actor.accessToken,
    );
    createdAuthUserId = authUser.id;
  }

  try {
    const employee = await prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          employeeCode: input.employeeCode,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          personalEmail: input.personalEmail,
          phone: input.phone,
          dateOfBirth: input.dateOfBirth,
          gender: input.gender,
          address: input.address,
          profilePhotoUrl: input.profilePhotoUrl,
          dateOfJoining: input.dateOfJoining,
          jobTitle: input.jobTitle,
          departmentId: input.departmentId,
          roleId: input.roleId,
          userId: createdAuthUserId,
          credentialsSentAt: createdAuthUserId && temporaryPassword ? new Date() : null,
        },
        include: employeeInclude,
      });

      await writeAudit(tx, {
        actorUserId: actor.id,
        action: 'EMPLOYEE_CREATED',
        entityType: 'EMPLOYEE',
        entityId: created.id,
        metadata: {
          employeeCode: created.employeeCode,
          departmentId: created.departmentId,
          roleId: created.roleId,
          provisionedAccount: Boolean(createdAuthUserId),
        },
      });

      return created;
    });

    // If an account was provisioned with temporary password, deliver credentials to personalEmail (or email)
    if (createdAuthUserId && temporaryPassword) {
      try {
        await emailService.sendCredentialEmail({
          toEmail: input.personalEmail || input.email,
          employeeName: `${input.firstName} ${input.lastName}`,
          officialEmail: input.email,
          username: generatedUsername || input.email,
          temporaryPassword,
          roleName: targetAuthRole,
        });
      } catch {
        // Mail delivery errors are logged by emailService; do not fail employee creation
      }
    }

    return toEmployeeDto(employee, { admin: true });
  } catch (error) {
    // Compensating rollback if auth account was created but DB insert failed
    if (createdAuthUserId && !input.userId && authServiceClient.isEnabled) {
      try {
        await authServiceClient.deleteUser(createdAuthUserId, actor.accessToken);
      } catch {
        // Rollback attempt failed
      }
    }
    throw error;
  }
}

interface UpdateEmployeeInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  personalEmail?: string | null;
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

export async function resendCredentials(id: string, actor: AuthUser) {
  const employee = await findEmployeeWithRelationsOrThrow(id);
  assertCanManageTarget(actor, employee.role.name);

  if (!authServiceClient.isEnabled) {
    throw conflict('AUTH_SERVICE_DISABLED', 'Auth service integration is disabled.');
  }

  let userId = employee.userId;
  const tempPassword = generateTemporaryPassword();
  let isReset = true;

  if (!userId) {
    // Provision new auth user if not previously provisioned
    const targetAuthRole =
      employee.role.name === ROLE_NAMES.SUPER_ADMIN
        ? ROLE_NAMES.SUPER_ADMIN
        : employee.role.name === ROLE_NAMES.HR_ADMIN
        ? ROLE_NAMES.HR_ADMIN
        : ROLE_NAMES.EMPLOYEE;

    const rawUsername = employee.employeeCode.toLowerCase().replace(/[^a-zA-Z0-9._-]/g, '_');
    const username = rawUsername.length >= 3 ? rawUsername : `emp_${rawUsername}`;

    const authUser = await authServiceClient.createUser(
      {
        email: employee.email,
        username,
        fullName: `${employee.firstName} ${employee.lastName}`,
        password: tempPassword,
        roles: [targetAuthRole],
      },
      actor.accessToken,
    );
    userId = authUser.id;
    isReset = false;

    await prisma.employee.update({
      where: { id: employee.id },
      data: { userId, credentialsSentAt: new Date() },
    });
  } else {
    // Reset existing account password and force mustChangePassword
    await authServiceClient.resetUserPassword(userId, tempPassword, actor.accessToken);
    await prisma.employee.update({
      where: { id: employee.id },
      data: { credentialsSentAt: new Date() },
    });
  }

  await writeAudit(prisma, {
    actorUserId: actor.id,
    action: isReset ? 'EMPLOYEE_CREDENTIALS_RESET' : 'EMPLOYEE_ACCOUNT_PROVISIONED',
    entityType: 'EMPLOYEE',
    entityId: employee.id,
    metadata: { employeeCode: employee.employeeCode, userId },
  });

  const rawUsername = employee.employeeCode.toLowerCase().replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeUsername = rawUsername.length >= 3 ? rawUsername : `emp_${rawUsername}`;

  const dispatchResult = await emailService.sendCredentialEmail({
    toEmail: employee.personalEmail || employee.email,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    officialEmail: employee.email,
    username: safeUsername,
    temporaryPassword: tempPassword,
    isPasswordReset: isReset,
    roleName: employee.role.name,
  });

  return {
    success: true,
    message: isReset
      ? 'Temporary password reset and credentials sent to employee.'
      : 'Account provisioned and credentials sent to employee.',
    deliveredTo: employee.personalEmail || employee.email,
    mode: dispatchResult.mode,
  };
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
