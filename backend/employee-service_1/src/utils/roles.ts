import { forbidden } from './errors';

/**
 * These are the role names the existing auth-service puts in the JWT
 * (backend/auth-service/src/common/constants/rbac.constants.ts).
 * We deliberately reuse them instead of inventing a second set.
 */
export const ROLE_NAMES = {
  EMPLOYEE: 'EMPLOYEE',
  HR_ADMIN: 'HR_ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];

export const ADMIN_ROLES: readonly RoleName[] = [ROLE_NAMES.HR_ADMIN, ROLE_NAMES.SUPER_ADMIN];

/** The logged-in user, taken from the verified JWT (never from the request body). */
export interface AuthUser {
  id: string; // auth-service user id (JWT "sub")
  roles: string[];
  accessToken: string; // kept only so we can forward it to the auth-service
}

export const isAdmin = (user: AuthUser): boolean => user.roles.some((role) => (ADMIN_ROLES as readonly string[]).includes(role));
export const isSuperAdmin = (user: AuthUser): boolean => user.roles.includes(ROLE_NAMES.SUPER_ADMIN);

/** Admins can see everyone. An ordinary employee can only see their own record. */
export function assertAdminOrSelf(actor: AuthUser, employee: { userId: string | null }): void {
  if (isAdmin(actor)) return;
  if (employee.userId !== null && employee.userId === actor.id) return;
  throw forbidden('FORBIDDEN', 'You can only access your own employee record');
}

/** Only a SUPER_ADMIN may change records of employees who are themselves SUPER_ADMIN. */
export function assertCanManageTarget(actor: AuthUser, targetRoleName: string): void {
  if (targetRoleName === ROLE_NAMES.SUPER_ADMIN && !isSuperAdmin(actor)) {
    throw forbidden('FORBIDDEN', 'Only a SUPER_ADMIN can modify a SUPER_ADMIN employee');
  }
}

/** Nobody may change their own status or role (stops self-elevation / self-reactivation). */
export function assertNotSelf(actor: AuthUser, employee: { userId: string | null }, action: string): void {
  if (employee.userId !== null && employee.userId === actor.id) {
    throw forbidden('CANNOT_MODIFY_SELF', `You cannot ${action} for your own account`);
  }
}
