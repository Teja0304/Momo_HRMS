import axios from 'axios';
import type { AxiosError } from 'axios';
import { API_URL } from '../config/env';
import type { ApiErrorBody, AuthResponse } from '../types/auth';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './tokenStorage';

/**
 * One centralised Axios instance for the whole app.
 *  - attaches "Authorization: Bearer <accessToken>" to every request
 *  - on 401 it silently refreshes the token ONCE and retries the request
 *  - on 403 PASSWORD_CHANGE_REQUIRED it tells the AuthContext (business case 5)
 */
export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/** Interceptor-free instance, used only for /auth/refresh (avoids infinite loops). */
const rawApi = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

interface AuthEventHandlers {
  onSessionExpired: () => void;
  onPasswordChangeRequired: () => void;
}

let handlers: AuthEventHandlers = {
  onSessionExpired: () => undefined,
  onPasswordChangeRequired: () => undefined,
};

/** Called once by AuthProvider so the client can talk back to the React state. */
export function setAuthEventHandlers(next: AuthEventHandlers): void {
  handlers = next;
}

let refreshInFlight: Promise<AuthResponse> | null = null;

/**
 * Exchanges the stored refresh token for a new token pair.
 * The backend ROTATES refresh tokens (each one works once), so two refreshes
 * running at the same time would break each other. This function is
 * "single flight": concurrent callers share the same request.
 */
export function refreshSession(): Promise<AuthResponse> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        throw new Error('NO_REFRESH_TOKEN');
      }
      try {
        const { data } = await rawApi.post<AuthResponse>('/auth/refresh', { refreshToken });
        await saveTokens(data.accessToken, data.refreshToken);
        return data;
      } catch (error) {
        // Only wipe the session when the SERVER rejected the token,
        // not when the phone/laptop is simply offline.
        if (
          axios.isAxiosError(error) &&
          error.response &&
          [400, 401, 403].includes(error.response.status)
        ) {
          await clearTokens();
        }
        throw error;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config;
    if (!original || !error.response) {
      return Promise.reject(error); // network error / timeout
    }

    const { status, data } = error.response;

    // Business case 5: backend says "you must change your password first".
    if (status === 403 && data?.error === 'PASSWORD_CHANGE_REQUIRED') {
      handlers.onPasswordChangeRequired();
      return Promise.reject(error);
    }

    const url = original.url ?? '';
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/refresh');

    if (status === 401 && !isAuthCall && !original.skipAuthRefresh && !original._retry) {
      original._retry = true;
      try {
        const session = await refreshSession();
        original.headers.Authorization = `Bearer ${session.accessToken}`;
        return api(original);
      } catch (refreshError) {
        // Offline while refreshing: keep the session, just fail this request.
        if (axios.isAxiosError(refreshError) && !refreshError.response) {
          return Promise.reject(error);
        }
        handlers.onSessionExpired();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);
