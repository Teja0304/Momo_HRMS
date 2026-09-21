import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Renders its children ONLY for a logged-in user who has no pending password reset.
 * (RootNavigator already registers screens by state; this is a second safety net.)
 * The real protection is always the backend - it re-checks every API call.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();

  if (status !== 'authenticated' || !user || user.mustChangePassword) {
    return null;
  }
  return <>{children}</>;
}
