import axios from 'axios';
import type { AxiosError, AxiosInstance } from 'axios';
import {
  API_URL,
  EMPLOYEE_API_URL,
  ATTENDANCE_API_URL,
  GEOFENCE_API_URL,
  NOTIFICATION_API_URL,
  FACE_API_URL,
} from '../config/env';
import type { ApiErrorBody, AuthResponse } from '../types/auth';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './tokenStorage';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export const employeeClient = axios.create({
  baseURL: EMPLOYEE_API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export const attendanceClient = axios.create({
  baseURL: ATTENDANCE_API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'x-gateway-secret': 'dev-gateway-secret',
  },
});

export const geofenceClient = axios.create({
  baseURL: GEOFENCE_API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'x-gateway-secret': 'dev-gateway-secret',
  },
});

export const notificationClient = axios.create({
  baseURL: NOTIFICATION_API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const faceClient = axios.create({
  baseURL: FACE_API_URL,
  timeout: 25000,
  headers: {
    'Content-Type': 'application/json',
  },
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

function attachInterceptors(instance: AxiosInstance) {
  instance.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiErrorBody>) => {
      const original = error.config as any;
      if (!original || !error.response) {
        return Promise.reject(error);
      }

      const { status, data } = error.response;

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
          return instance(original);
        } catch (refreshError) {
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
}

attachInterceptors(api);
attachInterceptors(employeeClient);
attachInterceptors(attendanceClient);
attachInterceptors(geofenceClient);
attachInterceptors(notificationClient);
