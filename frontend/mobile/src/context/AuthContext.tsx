import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { getCurrentUser, loginUser, logoutUser, resetPassword as resetPasswordApi } from '../api/authApi';
import { refreshSession, setAuthEventHandlers } from '../api/client';
import { clearTokens, getRefreshToken, saveTokens } from '../api/tokenStorage';
import type { AuthUser } from '../types/auth';
import { toAuthUser } from '../utils/roles';

type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** One-off message to show after a redirect (e.g. "session expired"). */
  notice: string | null;
  clearNotice: () => void;
  login: (email: string, password: string) => Promise<void>;
  resetPassword: (newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const NO_MODULE_MESSAGE =
  'Your account does not have access to any module. Please contact your administrator.';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const endSession = useCallback((message: string | null = null) => {
    setUser(null);
    setStatus('unauthenticated');
    setNotice(message);
  }, []);

  // Let the Axios interceptors talk back to React state.
  useEffect(() => {
    setAuthEventHandlers({
      onSessionExpired: () => {
        void clearTokens();
        endSession('Your session has expired. Please log in again.');
      },
      // Business case 5: the backend demands a password reset again.
      onPasswordChangeRequired: () =>
        setUser((current) => (current ? { ...current, mustChangePassword: true } : current)),
    });
  }, [endSession]);

  // Session restoration on app start: validate the stored refresh token with the backend.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stored = await getRefreshToken();
        if (!stored) {
          if (!cancelled) endSession();
          return;
        }

        const session = await refreshSession(); // rotates tokens + returns fresh user
        if (cancelled) return;

        const restored = toAuthUser(session.user);
        if (!restored.appRole) {
          await clearTokens();
          endSession(NO_MODULE_MESSAGE);
          return;
        }
        setUser(restored);
        setStatus('authenticated');
      } catch (error) {
        if (cancelled) return;
        const offline = axios.isAxiosError(error) && !error.response;
        endSession(offline ? 'Unable to reach the server. Please check your connection and log in.' : null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [endSession]);

  const login = useCallback(async (email: string, password: string) => {
    const session = await loginUser({ email: email.trim(), password });
    await saveTokens(session.accessToken, session.refreshToken);

    const loggedIn = toAuthUser(session.user);
    if (!loggedIn.appRole) {
      await logoutUser(); // don't leave a live session for an account we can't route
      await clearTokens();
      throw new Error(NO_MODULE_MESSAGE);
    }

    setNotice(null);
    setUser(loggedIn);
    setStatus('authenticated');
  }, []);

  const resetPassword = useCallback(async (newPassword: string) => {
    try {
      await resetPasswordApi(newPassword);
    } catch (error) {
      // 403 can mean "already set" - re-sync with the backend so we never get stuck.
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        try {
          setUser(await getCurrentUser());
        } catch {
          /* keep current state */
        }
      }
      throw error;
    }

    // Do NOT assume success: ask the backend for the real status.
    const fresh = await getCurrentUser();
    if (fresh.mustChangePassword) {
      throw new Error('The server did not confirm the password change. Please try again.');
    }
    setUser(fresh);
    setNotice('Your password was updated successfully.');
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    await clearTokens();
    endSession();
  }, [endSession]);

  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, notice, clearNotice, login, resetPassword, logout }),
    [status, user, notice, clearNotice, login, resetPassword, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
