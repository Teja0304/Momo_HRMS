import { DeviceStatus, EmploymentStatus } from '@prisma/client';

/**
 * Which employment status may follow which. Anything not listed is rejected with 409.
 * TERMINATED is final: to re-hire someone, create a new employee record.
 */
export const EMPLOYEE_TRANSITIONS: Record<EmploymentStatus, readonly EmploymentStatus[]> = {
  ACTIVE: ['INACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'],
  ON_LEAVE: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED'],
  SUSPENDED: ['ACTIVE', 'INACTIVE', 'TERMINATED'],
  INACTIVE: ['ACTIVE', 'TERMINATED'],
  TERMINATED: [],
};

/** Employees in these states still "work here" (used for department deactivation). */
export const CURRENT_EMPLOYMENT_STATUSES: readonly EmploymentStatus[] = ['ACTIVE', 'ON_LEAVE', 'SUSPENDED'];

export const DEVICE_TRANSITIONS: Record<DeviceStatus, readonly DeviceStatus[]> = {
  ACTIVE: ['INACTIVE', 'REVOKED'],
  INACTIVE: ['ACTIVE', 'REVOKED'],
  REVOKED: ['ACTIVE'], // only a SUPER_ADMIN may do this (checked in the device service)
};

export function canTransition<T extends string>(map: Record<T, readonly T[]>, from: T, to: T): boolean {
  return map[from].includes(to);
}
