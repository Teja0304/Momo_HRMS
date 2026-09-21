import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';

type Props = ComponentProps<typeof TextInput> & {
  /** Validation message. When set, the field turns red. */
  errorText?: string;
};

/** Rounded outlined text field with a built-in error line. */
export function AppTextInput({ errorText, style, ...rest }: Props) {
  return (
    <View style={styles.wrapper}>
      <TextInput
        mode="outlined"
        outlineStyle={styles.outline}
        style={[styles.input, style]}
        {...rest}
        error={Boolean(errorText)}
      />
      <HelperText type="error" visible={Boolean(errorText)} style={styles.helper}>
        {errorText}
      </HelperText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 2 },
  input: { backgroundColor: '#FFFFFF' },
  outline: { borderRadius: 12 },
  helper: { paddingHorizontal: 4 },
});
