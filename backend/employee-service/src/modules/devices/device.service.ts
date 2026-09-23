import { DeviceStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { conflict, forbidden, notFound } from '../../utils/errors';
import { buildMeta, toSkipTake } from '../../utils/pagination';
import { toDeviceDto } from '../../utils/serializers';
import { canTransition, DEVICE_TRANSITIONS } from '../../utils/transitions';
import { writeAudit } from '../../utils/audit';
import { isSuperAdmin, type AuthUser } from '../../utils/roles';

async function findEmployeeOrThrow(employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw notFound('EMPLOYEE_NOT_FOUND', 'Employee not found');
  return employee;
}

async function findDeviceOrThrow(id: string) {
  const device = await prisma.employeeDevice.findUnique({ where: { id } });
  if (!device) throw notFound('DEVICE_NOT_FOUND', 'Device not found');
  return device;
}

export async function registerDevice(
  employeeId: string,
  input: { deviceName: string; deviceType: 'ANDROID' | 'IOS' | 'WEB' | 'OTHER'; deviceIdentifier: string },
  actor: AuthUser,
) {
  await findEmployeeOrThrow(employeeId);

  const existing = await prisma.employeeDevice.findUnique({ where: { deviceIdentifier: input.deviceIdentifier } });
  if (existing) throw conflict('DEVICE_IDENTIFIER_TAKEN', 'This device identifier is already registered');

  const device = await prisma.$transaction(async (tx) => {
    const created = await tx.employeeDevice.create({ data: { employeeId, ...input } });
    await writeAudit(tx, {
      actorUserId: actor.id,
      action: 'DEVICE_REGISTERED',
      entityType: 'DEVICE',
      entityId: created.id,
      metadata: { employeeId, deviceType: created.deviceType },
    });
    return created;
  });

  return toDeviceDto(device, { includeIdentifier: true });
}

export async function listEmployeeDevices(employeeId: string, query: { page: number; limit: number; status?: DeviceStatus }) {
  await findEmployeeOrThrow(employeeId);
  const { skip, take } = toSkipTake(query.page, query.limit);
  const where = { employeeId, ...(query.status ? { status: query.status } : {}) };

  const [rows, total] = await prisma.$transaction([
    prisma.employeeDevice.findMany({ where, skip, take, orderBy: { registeredAt: 'desc' } }),
    prisma.employeeDevice.count({ where }),
  ]);

  return { data: rows.map((row) => toDeviceDto(row, { includeIdentifier: true })), meta: buildMeta(query.page, query.limit, total) };
}

export async function listDevices(query: { page: number; limit: number; status?: DeviceStatus; deviceType?: string }) {
  const { skip, take } = toSkipTake(query.page, query.limit);
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.deviceType ? { deviceType: query.deviceType as never } : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.employeeDevice.findMany({ where, skip, take, orderBy: { registeredAt: 'desc' } }),
    prisma.employeeDevice.count({ where }),
  ]);

  return { data: rows.map((row) => toDeviceDto(row, { includeIdentifier: false })), meta: buildMeta(query.page, query.limit, total) };
}

export async function getDeviceById(id: string) {
  const device = await findDeviceOrThrow(id);
  return toDeviceDto(device, { includeIdentifier: true });
}

export async function updateDevice(id: string, input: { deviceName?: string; deviceType?: 'ANDROID' | 'IOS' | 'WEB' | 'OTHER' }, actor: AuthUser) {
  await findDeviceOrThrow(id);
  const device = await prisma.$transaction(async (tx) => {
    const updated = await tx.employeeDevice.update({ where: { id }, data: input });
    await writeAudit(tx, {
      actorUserId: actor.id,
      action: 'DEVICE_UPDATED',
      entityType: 'DEVICE',
      entityId: id,
      metadata: { fields: Object.keys(input) },
    });
    return updated;
  });
  return toDeviceDto(device, { includeIdentifier: true });
}

export async function changeDeviceStatus(id: string, status: DeviceStatus, actor: AuthUser) {
  const device = await findDeviceOrThrow(id);

  if (!canTransition(DEVICE_TRANSITIONS, device.status, status)) {
    throw conflict('INVALID_DEVICE_STATUS_TRANSITION', `Cannot change device status from ${device.status} to ${status}`);
  }

  if (device.status === 'REVOKED' && status === 'ACTIVE' && !isSuperAdmin(actor)) {
    throw forbidden('FORBIDDEN', 'Only a SUPER_ADMIN can reactivate a revoked device');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.employeeDevice.update({
      where: { id },
      data: {
        status,
        revokedAt: status === 'REVOKED' ? new Date() : device.revokedAt,
      },
    });
    await writeAudit(tx, {
      actorUserId: actor.id,
      action: 'DEVICE_STATUS_CHANGED',
      entityType: 'DEVICE',
      entityId: id,
      metadata: { from: device.status, to: status },
    });
    return result;
  });

  return toDeviceDto(updated, { includeIdentifier: true });
}
