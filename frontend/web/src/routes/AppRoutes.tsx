import { Navigate, Route, Routes } from 'react-router-dom';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useAuth } from '../context/AuthContext';
import AdminHomePage from '../pages/AdminHomePage';
import EmployeeHomePage from '../pages/EmployeeHomePage';
import HrHomePage from '../pages/HrHomePage';
import LoginPage from '../pages/LoginPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import UnauthorizedPage from '../pages/UnauthorizedPage';
import EmployeeListPage from '../features/employees/pages/EmployeeListPage';
import EmployeeDetailsPage from '../features/employees/pages/EmployeeDetailsPage';
import AddEmployeePage from '../features/employees/pages/AddEmployeePage';
import EditEmployeePage from '../features/employees/pages/EditEmployeePage';
import { GuestRoute } from './GuestRoute';
import { PATHS, homePathForUser } from './paths';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleBasedRoute } from './RoleBasedRoute';

/** "/" and any unknown URL: send the user wherever they belong. */
function HomeRedirect() {
  const { status, user } = useAuth();
  if (status === 'loading') return <LoadingIndicator fullScreen />;
  return <Navigate to={homePathForUser(user)} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path={PATHS.login} element={<LoginPage />} />
      </Route>

      <Route element={<ProtectedRoute allowPasswordReset />}>
        <Route path={PATHS.resetPassword} element={<ResetPasswordPage />} />
        <Route path={PATHS.unauthorized} element={<UnauthorizedPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<RoleBasedRoute allowedRoles={['EMPLOYEE']} />}>
          <Route path={PATHS.employee} element={<EmployeeHomePage />} />
        </Route>
        <Route element={<RoleBasedRoute allowedRoles={['HR']} />}>
          <Route path={PATHS.hr} element={<HrHomePage />} />
        </Route>
        <Route element={<RoleBasedRoute allowedRoles={['ADMIN']} />}>
          <Route path={PATHS.admin} element={<AdminHomePage />} />
        </Route>

        {/* Employee Management accessible by both ADMIN and HR roles */}
        <Route element={<RoleBasedRoute allowedRoles={['ADMIN', 'HR']} />}>
          <Route path={PATHS.employees} element={<EmployeeListPage />} />
          <Route path={PATHS.addEmployee} element={<AddEmployeePage />} />
          <Route path={PATHS.employeeDetailsPattern} element={<EmployeeDetailsPage />} />
          <Route path={PATHS.editEmployeePattern} element={<EditEmployeePage />} />
        </Route>
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
