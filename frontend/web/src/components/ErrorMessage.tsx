import Alert from '@mui/material/Alert';

interface Props {
  message?: string | null;
  /** "error" (red, default) or "info" (blue, e.g. "session expired"). */
  variant?: 'error' | 'info';
}

/** Renders nothing when there is no message. */
export function ErrorMessage({ message, variant = 'error' }: Props) {
  if (!message) return null;

  return (
    <Alert severity={variant} sx={{ mb: 2, whiteSpace: 'pre-line' }}>
      {message}
    </Alert>
  );
}
