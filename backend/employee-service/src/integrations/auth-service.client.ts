import { env } from '../config/env';
import { AppError } from '../utils/errors';

/**
 * Tiny client for the existing auth-service (NestJS, port 3001).
 * We call it with the SAME bearer token the admin used to call us, so the
 * auth-service applies its own permission checks (we never impersonate anyone).
 *
 * If AUTH_SERVICE_URL is not set the client is disabled and every method is a no-op.
 */

export interface AuthUserSummary {
  id: string;
  email: string;
  roles: string[];
  isActive: boolean;
}

const baseUrl = env.AUTH_SERVICE_URL?.replace(/\/+$/, '');

async function call(method: 'GET' | 'PATCH', path: string, accessToken: string, body?: unknown): Promise<Response> {
  try {
    return await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(env.AUTH_SERVICE_TIMEOUT_MS),
    });
  } catch {
    throw new AppError(502, 'AUTH_SERVICE_UNAVAILABLE', 'The auth-service could not be reached. Try again later.');
  }
}

function failFor(response: Response): AppError {
  if (response.status === 401 || response.status === 403) {
    return new AppError(response.status, 'AUTH_SERVICE_REJECTED', 'The auth-service rejected this action for your account.');
  }
  return new AppError(502, 'AUTH_SERVICE_ERROR', `The auth-service answered with status ${response.status}.`);
}

export const authServiceClient = {
  isEnabled: baseUrl !== undefined,

  /** Returns the login account, or null if it does not exist. */
  async getUser(userId: string, accessToken: string): Promise<AuthUserSummary | null> {
    if (!baseUrl) return null;
    const response = await call('GET', `/auth/users/${encodeURIComponent(userId)}`, accessToken);
    if (response.status === 404) return null;
    if (!response.ok) throw failFor(response);
    const user = (await response.json()) as AuthUserSummary;
    return { id: user.id, email: user.email, roles: user.roles, isActive: user.isActive };
  },

  /** Replaces the login roles of a user (auth-service: PATCH /auth/users/:id, SUPER_ADMIN only). */
  async setUserRoles(userId: string, roleNames: string[], accessToken: string): Promise<void> {
    if (!baseUrl) return;
    const response = await call('PATCH', `/auth/users/${encodeURIComponent(userId)}`, accessToken, { roles: roleNames });
    if (response.status === 404) {
      throw new AppError(409, 'AUTH_USER_NOT_FOUND', 'The linked login account no longer exists in the auth-service.');
    }
    if (!response.ok) throw failFor(response);
  },
};
