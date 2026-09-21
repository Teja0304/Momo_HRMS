import { Navigate, Outlet } from 'react-router-dom';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useAuth } from '../context/AuthContext';
import { PATHS } from './paths';

interface Props {
  /** Only the Reset Password route sets this to true. */
  allowPasswordReset?: boolean;
}

/**
 * Layout route: logged-out users go to /login, and users whose backend record says
 * "mustChangePassword" are locked to /reset-password until they finish it.
 * (Frontend guards are for UX only - the backend re-checks every request.)
 */
export function ProtectedRoute({ allowPasswordReset = false }: Props) {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return <LoadingIndicator fullScreen message="Restoring your session..." />;
  }
  if (status !== 'authenticated' || !user) {
    return <Navigate to={PATHS.login} replace />;
  }
  if (user.mustChangePassword && !allowPasswordReset) {
    return <Navigate to={PATHS.resetPassword} replace />;
  }
  return <Outlet />;
}
