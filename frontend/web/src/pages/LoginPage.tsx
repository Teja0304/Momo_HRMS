import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Typography from '@mui/material/Typography';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import InputAdornment from '@mui/material/InputAdornment';
import { AppButton } from '../components/AppButton';
import { AppHeader } from '../components/AppHeader';
import { AppTextInput } from '../components/AppTextInput';
import { AuthLayout } from '../components/AuthLayout';
import { ErrorMessage } from '../components/ErrorMessage';
import { PasswordInput } from '../components/PasswordInput';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { useAuth } from '../context/AuthContext';
import { loginSchema } from '../schemas/authSchemas';
import type { LoginFormValues } from '../schemas/authSchemas';
import { getErrorMessage } from '../utils/errors';

export default function LoginPage() {
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
      // On success AuthContext updates and GuestRoute redirects to the user's module.
      await login(values.email, values.password);
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Login failed. Please try again.'));
    }
  });

  return (
    <AuthLayout>
      <AppHeader title="Welcome Back" subtitle="Login to continue" />

      <ErrorMessage message={notice} variant="info" />
      <ErrorMessage message={submitError} />

      <form onSubmit={onSubmit} noValidate>
        <Controller
          control={control}
          name="email"
          render={({ field: { ref, ...field } }) => (
            <AppTextInput
              {...field}
              inputRef={ref}
              label="Email"
              type="email"
              autoComplete="email"
              errorText={errors.email?.message}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailOutlinedIcon />
                    </InputAdornment>
                  ),
                },
              }}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { ref, ...field } }) => <PasswordInput {...field} inputRef={ref} label="Password" />}
        />

        <PasswordRequirements password={password} />

        <AppButton type="submit" loading={isSubmitting} disabled={!isValid}>
          Log in
        </AppButton>
      </form>

      <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 3 }}>
        Forgot your password? Ask your administrator to reset it for you.
      </Typography>
    </AuthLayout>
  );
}
