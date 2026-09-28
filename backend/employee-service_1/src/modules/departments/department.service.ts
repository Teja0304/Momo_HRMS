import { Prisma } from '@prisma/client';
import { prisma, lockDepartment } from '../../lib/prisma';
import { conflict, notFound } from '../../utils/errors';
import { buildMeta, toSkipTake } from '../../utils/pagination';
import { toDepartmentDto, toEmployeeDto, employeeInclude } from '../../utils/serializers';
import { CURRENT_EMPLOYMENT_STATUSES } from '../../utils/transitions';
import { writeAudit } from '../../utils/audit';
import type { AuthUser } from '../../utils/roles';

async function findDepartmentOrThrow(id: string) {
  const department = await prisma.department.findUnique({ where: { id } });
  if (!department) throw notFound('DEPARTMENT_NOT_FOUND', 'Department not found');
  return department;
}

export async function listDepartments(query: { page: number; limit: number; status?: 'ACTIVE' | 'INACTIVE'; search?: string }) {
  const where: Prisma.DepartmentWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [{ name: { contains: query.search } }, { code: { contains: query.search } }],
        }
      : {}),
  };

  const { skip, take } = toSkipTake(query.page, query.limit);
  const [rows, total] = await prisma.$transaction([
    prisma.department.findMany({
      where,
      skip,
      take,
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true } } },
    }),
    prisma.department.count({ where }),
  ]);

  return {
    data: rows.map((row) => toDepartmentDto(row, row._count.employees)),
    meta: buildMeta(query.page, query.limit, total),
  };
}

export async function getDepartmentById(id: string) {
  const department = await prisma.department.findUnique({ where: { id }, include: { _count: { select: { employees: true } } } });
  if (!department) throw notFound('DEPARTMENT_NOT_FOUND', 'Department not found');
  return toDepartmentDto(department, department._count.employees);
}

export async function createDepartment(input: { name: string; code: string; description?: string }, actor: AuthUser) {
  const existing = await prisma.department.findFirst({ where: { OR: [{ name: input.name }, { code: input.code }] } });
  if (existing) {
    throw conflict('DEPARTMENT_DUPLICATE', 'A department with the same name or code already exists');
  }

  const department = await prisma.$transaction(async (tx) => {
    const created = await tx.department.create({ data: input });
    await writeAudit(tx, {
      actorUserId: actor.id,
      action: 'DEPARTMENT_CREATED',
      entityType: 'DEPARTMENT',
      entityId: created.id,
      metadata: { name: created.name, code: created.code },
    });
    return created;
  });

  return toDepartmentDto(department, 0);
}

export async function updateDepartment(
  id: string,
  input: { name?: string; code?: string; description?: string | null },
  actor: AuthUser,
) {
  await findDepartmentOrThrow(id);

  if (input.name || input.code) {
    const clash = await prisma.department.findFirst({
      where: {
        id: { not: id },
        OR: [...(input.name ? [{ name: input.name }] : []), ...(input.code ? [{ code: input.code }] : [])],
      },
    });
    if (clash) throw conflict('DEPARTMENT_DUPLICATE', 'A department with the same name or code already exists');
  }

  const department = await prisma.$transaction(async (tx) => {
    const updated = await tx.department.update({ where: { id }, data: input });
    await writeAudit(tx, {
      actorUserId: actor.id,
      action: 'DEPARTMENT_UPDATED',
      entityType: 'DEPARTMENT',
      entityId: updated.id,
      metadata: { fields: Object.keys(input) },
    });
    return updated;
  });

  const employeeCount = await prisma.employee.count({ where: { departmentId: id } });
  return toDepartmentDto(department, employeeCount);
}

export async function changeDepartmentStatus(id: string, status: 'ACTIVE' | 'INACTIVE', reason: string | undefined, actor: AuthUser) {
  const result = await prisma.$transaction(async (tx) => {
    await lockDepartment(tx, id);
    const department = await tx.department.findUnique({ where: { id } });
    if (!department) throw notFound('DEPARTMENT_NOT_FOUND', 'Department not found');

    if (department.status === status) {
      return department;
    }

    if (status === 'INACTIVE') {
      const activeEmployeeCount = await tx.employee.count({
        where: { departmentId: id, status: { in: [...CURRENT_EMPLOYMENT_STATUSES] } },
      });
      if (activeEmployeeCount > 0) {
        throw conflict(
          'DEPARTMENT_HAS_ACTIVE_EMPLOYEES',
          `This department still has ${activeEmployeeCount} active employee(s). Reassign them to another department first.`,
          { activeEmployeeCount },
        );
      }
    }

    const updated = await tx.department.update({ where: { id }, data: { status } });
    await writeAudit(tx, {
      actorUserId: actor.id,
      action: 'DEPARTMENT_STATUS_CHANGED',
      entityType: 'DEPARTMENT',
      entityId: id,
      metadata: { from: department.status, to: status, reason: reason ?? null },
    });
    return updated;
  });

  const employeeCount = await prisma.employee.count({ where: { departmentId: id } });
  return toDepartmentDto(result, employeeCount);
}

export async function listDepartmentEmployees(id: string, query: { page: number; limit: number }) {
  await findDepartmentOrThrow(id);
  const { skip, take } = toSkipTake(query.page, query.limit);

  const [rows, total] = await prisma.$transaction([
    prisma.employee.findMany({
      where: { departmentId: id },
      skip,
      take,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: employeeInclude,
    }),
    prisma.employee.count({ where: { departmentId: id } }),
  ]);

  return {
    data: rows.map((row) => toEmployeeDto(row, { admin: true })),
    meta: buildMeta(query.page, query.limit, total),
  };
}
