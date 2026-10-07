import type { AppRole, AuthUser, BackendUser } from '../types/auth';

/** Role names exactly as stored by the backend (auth-service seed). */
export const BACKEND_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  HR_ADMIN: 'HR_ADMIN',
  EMPLOYEE: 'EMPLOYEE',
} as const;

/**
 * Backend role -> frontend module.
 * A user can hold several roles, so the highest one wins:
 * SUPER_ADMIN -> ADMIN, HR_ADMIN/HR -> HR, EMPLOYEE -> EMPLOYEE.
 * Also inspects official company HR email format (e.g. name.surname.hr@domain).
 */
export function resolveAppRole(roles: readonly string[] = [], email?: string): AppRole | null {
  const normRoles = roles.map((r) => String(r).toUpperCase());

  // 1. Admin roles
  if (normRoles.includes('SUPER_ADMIN') || normRoles.includes('ADMIN')) {
    return 'ADMIN';
  }

  // 2. HR roles (check role array and email pattern for HR personnel)
  const isHrRole =
    normRoles.includes('HR_ADMIN') ||
    normRoles.includes('HR') ||
    normRoles.includes('HR_MANAGER') ||
    normRoles.includes('HR_OFFICER') ||
    normRoles.includes('HR_STAFF') ||
    normRoles.some((r) => r.includes('HR'));

  const isHrEmail =
    Boolean(email) &&
    (email!.toLowerCase().includes('.hr@') ||
      email!.toLowerCase().includes('.hr.') ||
      email!.toLowerCase().startsWith('hr.') ||
      email!.toLowerCase().startsWith('hr-') ||
      email!.toLowerCase().includes('@hr.'));

  if (isHrRole || isHrEmail) {
    return 'HR';
  }

  // 3. Employee roles
  if (normRoles.includes('EMPLOYEE')) {
    return 'EMPLOYEE';
  }

  return null;
}

export function toAuthUser(user: BackendUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    roles: user.roles,
    permissions: user.permissions,
    mustChangePassword: user.mustChangePassword,
    appRole: resolveAppRole(user.roles, user.email),
  };
}

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: 'Admin',
  HR: 'HR',
  EMPLOYEE: 'Employee',
};
