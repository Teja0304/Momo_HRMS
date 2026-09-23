import type { Department, EmployeeDevice, FaceTemplateReference, Prisma, Role } from '@prisma/client';

/**
 * Serializers turn database rows into the exact JSON we return.
 * Nothing leaves the service unless it is listed here, which is how we make
 * sure internal fields never leak by accident.
 */

const dateOnly = (value: Date | null): string | null => (value ? value.toISOString().slice(0, 10) : null);

export const employeeInclude = {
  department: { select: { id: true, name: true, code: true, status: true } },
  role: { select: { id: true, name: true } },
} satisfies Prisma.EmployeeInclude;

export type EmployeeWithRelations = Prisma.EmployeeGetPayload<{ include: typeof employeeInclude }>;

/** `admin: true` adds the internal-ish fields (login link, who deactivated). */
export function toEmployeeDto(employee: EmployeeWithRelations, options: { admin: boolean }) {
  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone,
    dateOfBirth: dateOnly(employee.dateOfBirth),
    gender: employee.gender,
    address: employee.address,
    profilePhotoUrl: employee.profilePhotoUrl,
    dateOfJoining: dateOnly(employee.dateOfJoining),
    jobTitle: employee.jobTitle,
    department: employee.department,
    role: employee.role,
    status: employee.status,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
    ...(options.admin
      ? {
          userId: employee.userId,
          deactivatedAt: employee.deactivatedAt,
          deactivationReason: employee.deactivationReason,
          deactivatedBy: employee.deactivatedBy,
        }
      : {}),
  };
}

export function toDepartmentDto(department: Department, employeeCount?: number) {
  return {
    id: department.id,
    name: department.name,
    code: department.code,
    description: department.description,
    status: department.status,
    ...(employeeCount !== undefined ? { employeeCount } : {}),
    createdAt: department.createdAt,
    updatedAt: department.updatedAt,
  };
}

export function toRoleDto(role: Role, employeeCount?: number) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    ...(employeeCount !== undefined ? { employeeCount } : {}),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

export function toDeviceDto(device: EmployeeDevice, options: { includeIdentifier: boolean }) {
  return {
    id: device.id,
    employeeId: device.employeeId,
    deviceName: device.deviceName,
    deviceType: device.deviceType,
    ...(options.includeIdentifier ? { deviceIdentifier: device.deviceIdentifier } : {}),
    status: device.status,
    registeredAt: device.registeredAt,
    lastSeenAt: device.lastSeenAt,
    revokedAt: device.revokedAt,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
  };
}

/** Only metadata about the external biometric record. There is no template data to leak. */
export function toFaceTemplateDto(template: FaceTemplateReference) {
  return {
    id: template.id,
    employeeId: template.employeeId,
    externalReferenceId: template.externalReferenceId,
    provider: template.provider,
    status: template.status,
    enrolledAt: template.enrolledAt,
    expiresAt: template.expiresAt,
    revokedAt: template.revokedAt,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

/** "Live" = marked ACTIVE and not past its expiry date. */
export function isTemplateLive(template: { status: string; expiresAt: Date | null }, now: Date = new Date()): boolean {
  return template.status === 'ACTIVE' && (template.expiresAt === null || template.expiresAt.getTime() > now.getTime());
}
