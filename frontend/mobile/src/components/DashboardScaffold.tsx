import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip, Snackbar, Surface, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { palette } from '../theme/theme';
import { ROLE_LABELS } from '../utils/roles';
import { AppButton } from './AppButton';

interface Props {
  title: string;
  subtitle: string;
  children?: ReactNode;
}

/** Shared layout of the three module home screens (header, profile, logout, notice). */
export function DashboardScaffold({ title, subtitle, children }: Props) {
  const { user, logout, notice, clearNotice } = useAuth();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <Surface style={styles.card} elevation={1}>
          <Text style={styles.name}>{user?.fullName ?? user?.username}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.chips}>
            {user?.appRole ? <Chip icon="shield-account">{ROLE_LABELS[user.appRole]}</Chip> : null}
          </View>
        </Surface>

        {children}

        <AppButton mode="outlined" icon="logout" onPress={() => void logout()} style={styles.logout}>
          Log out
        </AppButton>
      </ScrollView>

      <Snackbar visible={Boolean(notice)} onDismiss={clearNotice} duration={4000}>
        {notice ?? ''}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: '700', color: palette.ink },
  subtitle: { fontSize: 15, color: palette.muted, lineHeight: 22 },
  card: { padding: 16, borderRadius: 16, backgroundColor: palette.surface },
  name: { fontSize: 18, fontWeight: '600', color: palette.ink },
  email: { color: palette.muted, marginTop: 2 },
  chips: { flexDirection: 'row', marginTop: 12, gap: 8 },
  logout: { marginTop: 8 },
});
