import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { palette } from '../theme/theme';

interface Props {
  message?: string | null;
  /** "error" (red, default) or "info" (blue, e.g. "session expired"). */
  variant?: 'error' | 'info';
}

/** Renders nothing when there is no message. */
export function ErrorMessage({ message, variant = 'error' }: Props) {
  if (!message) return null;

  const isError = variant === 'error';
  const color = isError ? palette.error : palette.primary;

  return (
    <View
      style={[styles.box, { backgroundColor: isError ? palette.errorSurface : palette.infoSurface }]}
      accessibilityRole="alert"
    >
      <Icon source={isError ? 'alert-circle-outline' : 'information-outline'} size={20} color={color} />
      <Text style={[styles.text, { color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  text: { flex: 1, fontSize: 14, lineHeight: 20 },
});
