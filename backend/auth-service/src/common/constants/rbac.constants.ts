export const ROLES_KEY = 'roles';
export const PERMISSIONS_KEY = 'permissions';
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Canonical role names. Kept as a const enum-like object (rather than a
 * TS enum) so it can be imported cleanly by other services later without
 * pulling in NestJS-specific decorators.
 */
export const ROLE_NAMES = {
  EMPLOYEE: 'EMPLOYEE',
  HR_ADMIN: 'HR_ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];
