import Button from '@mui/material/Button';
import type { ButtonProps } from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

interface Props extends ButtonProps {
  loading?: boolean;
}

/** Full-width primary button with a built-in loading spinner. */
export function AppButton({ loading = false, disabled, startIcon, children, ...rest }: Props) {
  return (
    <Button
      variant="contained"
      size="large"
      fullWidth
      disableElevation
      disabled={disabled || loading}
      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : startIcon}
      {...rest}
    >
      {children}
    </Button>
  );
}
