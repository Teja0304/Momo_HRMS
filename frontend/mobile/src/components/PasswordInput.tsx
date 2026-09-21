import type { ComponentProps } from 'react';
import { useState } from 'react';
import { TextInput } from 'react-native-paper';
import { AppTextInput } from './AppTextInput';

type Props = Omit<ComponentProps<typeof AppTextInput>, 'secureTextEntry' | 'right'>;

/** Password field with a show / hide eye icon. */
export function PasswordInput(props: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <AppTextInput
      autoCapitalize="none"
      autoCorrect={false}
      left={<TextInput.Icon icon="lock-outline" />}
      {...props}
      secureTextEntry={!visible}
      right={
        <TextInput.Icon
          icon={visible ? 'eye-off-outline' : 'eye-outline'}
          onPress={() => setVisible((current) => !current)}
          forceTextInputFocus={false}
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        />
      }
    />
  );
}
