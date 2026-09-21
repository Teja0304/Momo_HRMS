import axios from 'axios';
import type { AuthResponse, AuthUser, BackendUser } from '../types/auth';
import { toAuthUser } from '../utils/roles';
import { api, refreshSession } from './client';
import { getRefreshToken } from './tokenStorage';

/**
 * POST /auth/login          (public, rate limited: 5 tries / minute / IP+email)
 * Body:     { email, password }
 * Response: { accessToken, refreshToken, user: { id, email, username, fullName,
 *             roles[], permissions[], mustChangePassword } }
 * Errors:   401 "Invalid credentials" (wrong email/password/inactive), 429 too many tries.
 */
export async function loginUser(payload: { email: string; password: string }): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', payload);
  return data;
}

/**
 * GET /auth/me              (needs access token; allowed even if a password change is pending)
 * Response: { id, username, fullName, email, roles[], permissions[], isActive, mustChangePassword }
 * Used to confirm the CURRENT role and password-reset status straight from the backend.
 */
export async function getCurrentUser(): Promise<AuthUser> {
  const { data } = await api.get<BackendUser>('/auth/me');
  return toAuthUser(data);
}

/**
 * POST /auth/set-initial-password   (needs access token)
 * Body:     { newPassword }        (no current password needed)
 * Response: { success: true }
 * Only works while the backend still has mustChangePassword = true,
 * otherwise 403 "A password has already been set...".
 */
export async function resetPassword(newPassword: string): Promise<void> {
  await api.post<{ success: true }>('/auth/set-initial-password', { newPassword });
}

/**
 * POST /auth/refresh        (public)  Body: { refreshToken }
 * Returns a NEW token pair (rotation) and the fresh user object.
 */
export async function refreshToken(): Promise<AuthResponse> {
  return refreshSession();
}

/**
 * POST /auth/logout         (needs access token)  Body: { refreshToken }
 * Revokes the refresh-token session on the server. Best effort: the caller
 * clears local data regardless of the outcome.
 */
export async function logoutUser(): Promise<void> {
  const token = await getRefreshToken();
  if (!token) return;

  try {
    await api.post('/auth/logout', { refreshToken: token }, { skipAuthRefresh: true });
  } catch (error) {
    // Access token expired? Get a fresh pair and revoke the NEW session instead.
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      try {
        const session = await refreshSession();
        await api.post(
          '/auth/logout',
          { refreshToken: session.refreshToken },
          { skipAuthRefresh: true },
        );
      } catch {
        /* ignore - local logout still happens */
      }
    }
  }
}
