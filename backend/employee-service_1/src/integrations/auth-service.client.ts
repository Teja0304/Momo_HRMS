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

export interface CreateAuthUserPayload {
  email: string;
  username: string;
  fullName: string;
  password: string;
  roles: string[];
}

const baseUrl = env.AUTH_SERVICE_URL?.replace(/\/+$/, '');

async function call(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  accessToken: string,
  body?: unknown,
): Promise<Response> {
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

async function failFor(response: Response): Promise<AppError> {
  if (response.status === 401 || response.status === 403) {
    return new AppError(response.status, 'AUTH_SERVICE_REJECTED', 'The auth-service rejected this action for your account.');
  }
  let message = `The auth-service answered with status ${response.status}.`;
  try {
    const errorJson = (await response.json()) as { message?: string | string[] };
    if (errorJson?.message) {
      message = Array.isArray(errorJson.message) ? errorJson.message.join(', ') : errorJson.message;
    }
  } catch {
    // Keep default message
  }
  return new AppError(response.status >= 400 && response.status < 500 ? response.status : 502, 'AUTH_SERVICE_ERROR', message);
}

export const authServiceClient = {
  isEnabled: baseUrl !== undefined,

  /** Returns the login account, or null if it does not exist. */
  async getUser(userId: string, accessToken: string): Promise<AuthUserSummary | null> {
    if (!baseUrl) return null;
    const response = await call('GET', `/auth/users/${encodeURIComponent(userId)}`, accessToken);
    if (response.status === 404) return null;
    if (!response.ok) throw await failFor(response);
    const user = (await response.json()) as AuthUserSummary;
    return { id: user.id, email: user.email, roles: user.roles, isActive: user.isActive };
  },

  /** Replaces the login roles of a user (auth-service: PATCH /auth/users/:id). */
  async setUserRoles(userId: string, roleNames: string[], accessToken: string): Promise<void> {
    if (!baseUrl) return;
    const response = await call('PATCH', `/auth/users/${encodeURIComponent(userId)}`, accessToken, { roles: roleNames });
    if (response.status === 404) {
      throw new AppError(409, 'AUTH_USER_NOT_FOUND', 'The linked login account no longer exists in the auth-service.');
    }
    if (!response.ok) throw await failFor(response);
  },

  /** Creates a user account in the auth-service (POST /auth/users). */
  async createUser(payload: CreateAuthUserPayload, accessToken: string): Promise<AuthUserSummary> {
    if (!baseUrl) {
      throw new AppError(500, 'AUTH_SERVICE_NOT_CONFIGURED', 'AUTH_SERVICE_URL is not configured.');
    }
    const response = await call('POST', '/auth/users', accessToken, payload);
    if (response.status === 409) {
      throw new AppError(409, 'AUTH_USER_CONFLICT', 'A user account with this email or username already exists in auth-service.');
    }
    if (!response.ok) throw await failFor(response);
    const user = (await response.json()) as AuthUserSummary;
    return { id: user.id, email: user.email, roles: user.roles, isActive: user.isActive };
  },

  /** Resets temporary password for an auth user (POST /auth/users/:id/reset-password). */
  async resetUserPassword(userId: string, temporaryPassword: string, accessToken: string): Promise<void> {
    if (!baseUrl) {
      throw new AppError(500, 'AUTH_SERVICE_NOT_CONFIGURED', 'AUTH_SERVICE_URL is not configured.');
    }
    const response = await call('POST', `/auth/users/${encodeURIComponent(userId)}/reset-password`, accessToken, {
      temporaryPassword,
    });
    if (response.status === 404) {
      throw new AppError(404, 'AUTH_USER_NOT_FOUND', 'The linked login account no longer exists in the auth-service.');
    }
    if (!response.ok) throw await failFor(response);
  },

  /** Deletes an auth user (DELETE /auth/users/:id) for rollback purposes. */
  async deleteUser(userId: string, accessToken: string): Promise<void> {
    if (!baseUrl) return;
    const response = await call('DELETE', `/auth/users/${encodeURIComponent(userId)}`, accessToken);
    if (response.status === 404) return;
    if (!response.ok) throw await failFor(response);
  },
};

