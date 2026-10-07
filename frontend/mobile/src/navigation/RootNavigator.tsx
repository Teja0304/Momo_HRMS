import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { RoleBasedRoute } from '../components/RoleBasedRoute';
import { useAuth } from '../context/AuthContext';
import EmployeeHomeScreen from '../screens/EmployeeHomeScreen';
import AttendanceHistoryScreen from '../screens/AttendanceHistoryScreen';
import ProfileCompletionScreen from '../screens/ProfileCompletionScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import LoginScreen from '../screens/LoginScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import FaceRegistrationScreen from '../screens/FaceRegistrationScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function ProtectedEmployeeScreen() {
  return (
    <ProtectedRoute>
      <RoleBasedRoute allowedRoles={['EMPLOYEE']}>
        <EmployeeHomeScreen />
      </RoleBasedRoute>
    </ProtectedRoute>
  );
}

function ProtectedHistoryScreen() {
  return (
    <ProtectedRoute>
      <RoleBasedRoute allowedRoles={['EMPLOYEE']}>
        <AttendanceHistoryScreen />
      </RoleBasedRoute>
    </ProtectedRoute>
  );
}

function ProtectedProfileScreen() {
  return (
    <ProtectedRoute>
      <RoleBasedRoute allowedRoles={['EMPLOYEE']}>
        <ProfileScreen />
      </RoleBasedRoute>
    </ProtectedRoute>
  );
}

function ProtectedNotificationsScreen() {
  return (
    <ProtectedRoute>
      <RoleBasedRoute allowedRoles={['EMPLOYEE']}>
        <NotificationsScreen />
      </RoleBasedRoute>
    </ProtectedRoute>
  );
}

/**
 * Root Navigator for the Momo HRMS Employee Mobile Application.
 *
 * Platform Rule:
 *  - Mobile is strictly reserved for EMPLOYEE accounts.
 *  - ADMIN & HR are blocked at login & session restoration in AuthContext.
 *
 * Flow:
 *  1. Unauthenticated -> LoginScreen
 *  2. mustChangePassword === true -> ResetPasswordScreen (forced, non-bypassable)
 *  3. Incomplete profile -> ProfileCompletionScreen (DOB, phone, gender, address)
 *  4. Incomplete face biometrics -> FaceRegistrationScreen (once only)
 *  5. Complete profile & biometrics -> EmployeeHomeScreen & AttendanceHistoryScreen
 */
export function RootNavigator() {
  const { status, user, isProfileComplete, isFaceEnrolled } = useAuth();

  if (status === 'loading') {
    return <LoadingIndicator fullScreen message="Loading Momo HRMS..." />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {status !== 'authenticated' || !user ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : user.mustChangePassword ? (
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      ) : !isProfileComplete ? (
        <Stack.Screen name="ProfileCompletion" component={ProfileCompletionScreen} />
      ) : !isFaceEnrolled ? (
        <Stack.Screen name="FaceRegistration" component={FaceRegistrationScreen} />
      ) : (
        <>
          <Stack.Screen name="EmployeeHome" component={ProtectedEmployeeScreen} />
          <Stack.Screen name="AttendanceHistory" component={ProtectedHistoryScreen} />
          <Stack.Screen name="Profile" component={ProtectedProfileScreen} />
          <Stack.Screen name="Notifications" component={ProtectedNotificationsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
