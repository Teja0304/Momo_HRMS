import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { AppRole } from '../types/auth';
import { PATHS } from './paths';

/** Layout route: only lets users whose module role is in `allowedRoles` through. */
export function RoleBasedRoute({ allowedRoles }: { allowedRoles: AppRole[] }) {
  const { user } = useAuth();

  if (!user?.appRole || !allowedRoles.includes(user.appRole)) {
    return <Navigate to={PATHS.unauthorized} replace />;
  }
  return <Outlet />;
}
