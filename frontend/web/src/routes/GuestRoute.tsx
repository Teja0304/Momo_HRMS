import { Navigate, Outlet } from 'react-router-dom';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useAuth } from '../context/AuthContext';
import { homePathForUser } from './paths';

/** Layout route for /login: logged-in users are sent to their own module instead. */
export function GuestRoute() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return <LoadingIndicator fullScreen message="Restoring your session..." />;
  }
  if (status === 'authenticated' && user) {
    return <Navigate to={homePathForUser(user)} replace />;
  }
  return <Outlet />;
}
