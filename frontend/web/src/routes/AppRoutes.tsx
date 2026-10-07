import { Navigate, Route, Routes } from 'react-router-dom';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useAuth } from '../context/AuthContext';
import AdminHomePage from '../pages/AdminHomePage';
import HrHomePage from '../pages/HrHomePage';
import HrEmployeeReportPage from '../pages/HrEmployeeReportPage';
import LoginPage from '../pages/LoginPage';

import ResetPasswordPage from '../pages/ResetPasswordPage';
import UnauthorizedPage from '../pages/UnauthorizedPage';
import EmployeeListPage from '../features/employees/pages/EmployeeListPage';
import EmployeeDetailsPage from '../features/employees/pages/EmployeeDetailsPage';
import AddEmployeePage from '../features/employees/pages/AddEmployeePage';
import EditEmployeePage from '../features/employees/pages/EditEmployeePage';
import EmployeeImportPage from '../features/employees/pages/EmployeeImportPage';
import AttendanceDashboardPage from '../features/attendance/pages/AttendanceDashboardPage';
import AttendanceHistoryPage from '../features/attendance/pages/AttendanceHistoryPage';
import AttendanceDetailsPage from '../features/attendance/pages/AttendanceDetailsPage';
import AttendanceReportsPage from '../features/attendance/pages/AttendanceReportsPage';
import GeofenceListPage from '../features/geofence/pages/GeofenceListPage';
import AddOfficePage from '../features/geofence/pages/AddOfficePage';
import EditOfficePolygonPage from '../features/geofence/pages/EditOfficePolygonPage';
import NotificationListPage from '../features/notifications/pages/NotificationListPage';
import NotificationHistoryPage from '../features/notifications/pages/NotificationHistoryPage';
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
        {/* Dashboard and employee shortcut redirects */}
        <Route path={PATHS.dashboard} element={<HomeRedirect />} />
        <Route path={PATHS.employee} element={<Navigate to={PATHS.attendance} replace />} />

        {/* Personal attendance self-punch routes accessible to Employee only */}
        <Route element={<RoleBasedRoute allowedRoles={['EMPLOYEE']} />}>
          <Route path={PATHS.attendance} element={<AttendanceDashboardPage />} />
          <Route path={PATHS.attendanceHistory} element={<AttendanceHistoryPage />} />
          <Route path={PATHS.attendanceDetailsPattern} element={<AttendanceDetailsPage />} />
        </Route>

        {/* Notifications accessible to all authenticated roles (Admin, HR, Employee) */}
        <Route element={<RoleBasedRoute allowedRoles={['ADMIN', 'HR', 'EMPLOYEE']} />}>
          <Route path={PATHS.notifications} element={<NotificationListPage />} />
          <Route path={PATHS.notificationHistory} element={<NotificationHistoryPage />} />
        </Route>

        {/* Management routes accessible to Admin and HR */}
        <Route element={<RoleBasedRoute allowedRoles={['ADMIN', 'HR']} />}>
          <Route path={PATHS.employees} element={<EmployeeListPage />} />
          <Route path={PATHS.employeeDetailsPattern} element={<EmployeeDetailsPage />} />
          <Route path={PATHS.attendanceReports} element={<AttendanceReportsPage />} />
        </Route>

        {/* HR & Management Dashboard routes */}
        <Route element={<RoleBasedRoute allowedRoles={['HR', 'ADMIN']} />}>
          <Route path={PATHS.hr} element={<HrHomePage />} />
          <Route path={PATHS.hrEmployeeReportPattern} element={<HrEmployeeReportPage />} />
        </Route>


        {/* ADMIN-only routes (Geofences & Office setup, Employee creation, bulk import, profile edit) */}
        <Route element={<RoleBasedRoute allowedRoles={['ADMIN']} />}>
          <Route path={PATHS.admin} element={<AdminHomePage />} />
          <Route path={PATHS.addEmployee} element={<AddEmployeePage />} />
          <Route path={PATHS.importEmployees} element={<EmployeeImportPage />} />
          <Route path={PATHS.editEmployeePattern} element={<EditEmployeePage />} />
          <Route path={PATHS.geofences} element={<GeofenceListPage />} />
          <Route path={PATHS.addGeofence} element={<AddOfficePage />} />
          <Route path={PATHS.editGeofencePattern} element={<EditOfficePolygonPage />} />
        </Route>
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}

