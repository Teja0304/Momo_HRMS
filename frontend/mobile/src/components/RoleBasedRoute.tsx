import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import type { AppRole } from '../types/auth';
import { AppButton } from './AppButton';

interface Props {
  allowedRoles: AppRole[];
  children: ReactNode;
}

/** Shows the children only when the user's module role is in `allowedRoles`. */
export function RoleBasedRoute({ allowedRoles, children }: Props) {
  const { user, logout } = useAuth();

  if (user?.appRole && allowedRoles.includes(user.appRole)) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall">Access denied</Text>
      <Text style={styles.text}>You do not have permission to view this section.</Text>
      <AppButton mode="outlined" onPress={() => void logout()}>
        Log out
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  text: { textAlign: 'center', marginBottom: 12 },
});
