import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { COMPANY_NAME } from '../config/env';
import { palette } from '../theme/theme';

interface Props {
  title: string;
  subtitle?: string;
  showLogo?: boolean;
}

/** Logo placeholder + company name + screen heading. Replace the icon with your real logo. */
export function AppHeader({ title, subtitle, showLogo = true }: Props) {
  return (
    <View style={styles.container}>
      {showLogo && (
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Icon source="account-group" size={26} color="#FFFFFF" />
          </View>
          <Text style={styles.company}>{COMPANY_NAME}</Text>
        </View>
      )}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  company: { fontSize: 20, fontWeight: '700', color: palette.ink },
  title: { fontSize: 30, fontWeight: '700', color: palette.ink },
  subtitle: { fontSize: 15, color: palette.muted, marginTop: 6, lineHeight: 22 },
});
