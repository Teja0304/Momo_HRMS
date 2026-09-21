import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import { AppButton } from '../components/AppButton';
import { AppHeader } from '../components/AppHeader';
import { AuthLayout } from '../components/AuthLayout';
import { ErrorMessage } from '../components/ErrorMessage';
import { PasswordInput } from '../components/PasswordInput';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { useAuth } from '../context/AuthContext';
import { homePathForUser } from '../routes/paths';
import { resetPasswordSchema } from '../schemas/authSchemas';
import type { ResetPasswordFormValues } from '../schemas/authSchemas';
import { getErrorMessage } from '../utils/errors';

export default function ResetPasswordPage() {
  const { user, resetPassword, logout } = useAuth();
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
      // Resolves only after the backend CONFIRMED the change. On failure we stay here.
      await resetPassword(values.newPassword);
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Could not update your password. Please try again.'));
    }
  });

  // The backend says no reset is needed (or it just finished): go to the dashboard.
  if (user && !user.mustChangePassword) {
    return <Navigate to={homePathForUser(user)} replace />;
  }

  return (
    <AuthLayout>
      <AppHeader
        title="Create a New Password"
        subtitle="For your account security, please update your password to continue."
      />

      <ErrorMessage message={submitError} />

      <form onSubmit={onSubmit} noValidate>
        <Controller
          control={control}
          name="newPassword"
          render={({ field: { ref, ...field } }) => (
            <PasswordInput {...field} inputRef={ref} label="New Password" autoComplete="new-password" />
          )}
        />

        <PasswordRequirements password={newPassword} />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { ref, ...field } }) => (
            <PasswordInput
              {...field}
              inputRef={ref}
              label="Confirm New Password"
              autoComplete="new-password"
              errorText={errors.confirmPassword?.message ?? (mismatch ? 'Passwords do not match' : undefined)}
            />
          )}
        />

        <AppButton type="submit" loading={isSubmitting} disabled={!isValid || mismatch} sx={{ mt: 1 }}>
          Update Password
        </AppButton>
      </form>

      <Button fullWidth sx={{ mt: 1 }} onClick={() => void logout()} disabled={isSubmitting}>
        Log out
      </Button>
    </AuthLayout>
  );
}
