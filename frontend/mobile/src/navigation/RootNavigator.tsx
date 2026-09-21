import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { RoleBasedRoute } from '../components/RoleBasedRoute';
import { useAuth } from '../context/AuthContext';
import AdminHomeScreen from '../screens/AdminHomeScreen';
import EmployeeHomeScreen from '../screens/EmployeeHomeScreen';
import HrHomeScreen from '../screens/HrHomeScreen';
import LoginScreen from '../screens/LoginScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Each module screen is wrapped twice: logged in + correct role.
function EmployeeScreen() {
  return (
    <ProtectedRoute>
      <RoleBasedRoute allowedRoles={['EMPLOYEE']}>
        <EmployeeHomeScreen />
      </RoleBasedRoute>
    </ProtectedRoute>
  );
}

function AdminScreen() {
  return (
    <ProtectedRoute>
      <RoleBasedRoute allowedRoles={['ADMIN']}>
        <AdminHomeScreen />
      </RoleBasedRoute>
    </ProtectedRoute>
  );
}

function HrScreen() {
  return (
    <ProtectedRoute>
      <RoleBasedRoute allowedRoles={['HR']}>
        <HrHomeScreen />
      </RoleBasedRoute>
    </ProtectedRoute>
  );
}

/**
 * The screens that exist depend on the auth state (the recommended React Navigation pattern):
 *   loading            -> splash
 *   logged out         -> Login
 *   mustChangePassword -> ResetPassword   (comes from the BACKEND, every time)
 *   ADMIN / HR / EMPLOYEE -> only their own module screen is registered
 * When the state changes, the navigator switches screens automatically.
 */
export function RootNavigator() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return <LoadingIndicator fullScreen message="Restoring your session..." />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {status !== 'authenticated' || !user ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : user.mustChangePassword ? (
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      ) : user.appRole === 'ADMIN' ? (
        <Stack.Screen name="AdminHome" component={AdminScreen} />
      ) : user.appRole === 'HR' ? (
        <Stack.Screen name="HrHome" component={HrScreen} />
      ) : (
        <Stack.Screen name="EmployeeHome" component={EmployeeScreen} />
      )}
    </Stack.Navigator>
  );
}
