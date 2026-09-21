/**
 * Types that mirror the responses of the Momo HRMS auth-service backend.
 * Backend roles are SUPER_ADMIN / HR_ADMIN / EMPLOYEE; the frontend maps them
 * to three "modules": ADMIN / HR / EMPLOYEE (see utils/roles.ts).
 */

export type AppRole = 'ADMIN' | 'HR' | 'EMPLOYEE';

/** The user object exactly as the backend sends it (login, refresh, /auth/me). */
export interface BackendUser {
  id: string;
  email: string;
  username: string;
  fullName: string | null;
  roles: string[];
  permissions: string[];
  mustChangePassword: boolean;
  isActive?: boolean;
}

/** Response of POST /auth/login and POST /auth/refresh. */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: BackendUser;
}

/** The user object used inside the app (backend user + resolved module role). */
export interface AuthUser extends Omit<BackendUser, 'isActive'> {
  /** null means the account has no role this app knows about. */
  appRole: AppRole | null;
}

/** Shape of every error body produced by the backend's HttpExceptionFilter. */
export interface ApiErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
  path?: string;
}
