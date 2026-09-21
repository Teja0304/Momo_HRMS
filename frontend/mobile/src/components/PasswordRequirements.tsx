import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { palette } from '../theme/theme';
import { evaluatePasswordRules } from '../utils/passwordRules';

interface Props {
  password: string;
}

/**
 * Live checklist. Empty field => every rule is RED.
 * Each rule turns GREEN (with a check) the moment it is satisfied.
 */
export function PasswordRequirements({ password }: Props) {
  const results = useMemo(() => evaluatePasswordRules(password), [password]);

  return (
    <View style={styles.list} accessibilityLabel="Password requirements">
      {results.map((rule) => {
        const color = rule.passed ? palette.success : palette.error;
        return (
          <View key={rule.id} style={styles.row}>
            <Icon source={rule.passed ? 'check-circle' : 'close-circle'} size={18} color={color} />
            <Text style={[styles.label, { color }]}>{rule.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 6, paddingVertical: 4, paddingHorizontal: 4, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 13 },
});
