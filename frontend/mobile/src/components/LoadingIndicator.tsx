import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { palette } from '../theme/theme';

interface Props {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingIndicator({ message, fullScreen = false }: Props) {
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size="large" color={palette.primary} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: 16 },
  fullScreen: { flex: 1, backgroundColor: palette.background },
  message: { marginTop: 12, color: palette.muted },
});
