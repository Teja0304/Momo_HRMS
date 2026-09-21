import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';

type Props = ComponentProps<typeof Button>;

/** Full-width, rounded primary button. Pass `loading` to show a spinner. */
export function AppButton({ style, contentStyle, labelStyle, mode = 'contained', ...rest }: Props) {
  return (
    <Button
      mode={mode}
      style={[styles.button, style]}
      contentStyle={[styles.content, contentStyle]}
      labelStyle={[styles.label, labelStyle]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 12 },
  content: { height: 50 },
  label: { fontSize: 16, fontWeight: '600' },
});
