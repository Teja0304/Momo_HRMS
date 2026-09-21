import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '../components/AppButton';
import { AppHeader } from '../components/AppHeader';
import { AppTextInput } from '../components/AppTextInput';
import { ErrorMessage } from '../components/ErrorMessage';
import { PasswordInput } from '../components/PasswordInput';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { useAuth } from '../context/AuthContext';
import { loginSchema } from '../schemas/authSchemas';
import type { LoginFormValues } from '../schemas/authSchemas';
import { palette } from '../theme/theme';
import { getErrorMessage } from '../utils/errors';

export default function LoginScreen() {
  const { login, notice } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: { email: '', password: '' },
  });

  const password = watch('password');

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      // On success AuthContext updates and RootNavigator swaps this screen out.
      await login(values.email, values.password);
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Login failed. Please try again.'));
    }
  });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppHeader title="Welcome Back" subtitle="Login to continue" />

          <ErrorMessage message={notice} variant="info" />
          <ErrorMessage message={submitError} />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppTextInput
                label="Email"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                left={<TextInput.Icon icon="email-outline" />}
                errorText={errors.email?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <PasswordInput
                label="Password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoComplete="password"
                textContentType="password"
                // The checklist below already explains what is wrong.
              />
            )}
          />

          <PasswordRequirements password={password} />

          <AppButton
            onPress={onSubmit}
            loading={isSubmitting}
            disabled={!isValid || isSubmitting}
            accessibilityLabel="Log in"
          >
            Log in
          </AppButton>

          <View style={styles.helpBox}>
            <Text style={styles.help}>
              Forgot your password? Ask your administrator to reset it for you.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  helpBox: { marginTop: 20, alignItems: 'center' },
  help: { color: palette.muted, fontSize: 13, textAlign: 'center' },
});
