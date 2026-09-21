import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppButton } from '../components/AppButton';
import { AppHeader } from '../components/AppHeader';
import { ErrorMessage } from '../components/ErrorMessage';
import { PasswordInput } from '../components/PasswordInput';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { useAuth } from '../context/AuthContext';
import { resetPasswordSchema } from '../schemas/authSchemas';
import type { ResetPasswordFormValues } from '../schemas/authSchemas';
import { palette } from '../theme/theme';
import { getErrorMessage } from '../utils/errors';

export default function ResetPasswordScreen() {
  const { resetPassword, logout } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const newPassword = watch('newPassword');
  const confirmPassword = watch('confirmPassword');
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      // Resolves only after the backend CONFIRMED the change; the navigator
      // then moves to the dashboard on its own. On failure we stay right here.
      await resetPassword(values.newPassword);
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Could not update your password. Please try again.'));
    }
  });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppHeader
            title="Create a New Password"
            subtitle="For your account security, please update your password to continue."
          />

          <ErrorMessage message={submitError} />

          <Controller
            control={control}
            name="newPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <PasswordInput
                label="New Password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                textContentType="newPassword"
              />
            )}
          />

          <PasswordRequirements password={newPassword} />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <PasswordInput
                label="Confirm New Password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                textContentType="newPassword"
                errorText={errors.confirmPassword?.message ?? (mismatch ? 'Passwords do not match' : undefined)}
              />
            )}
          />

          <AppButton
            onPress={onSubmit}
            loading={isSubmitting}
            disabled={!isValid || mismatch || isSubmitting}
            style={styles.submit}
          >
            Update Password
          </AppButton>

          <AppButton mode="text" onPress={() => void logout()} disabled={isSubmitting}>
            Log out
          </AppButton>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  submit: { marginBottom: 8 },
});
