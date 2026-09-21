import TextField from '@mui/material/TextField';
import type { OutlinedTextFieldProps } from '@mui/material/TextField';

export type AppTextInputProps = Omit<OutlinedTextFieldProps, 'variant' | 'error' | 'helperText'> & {
  /** Validation message. When set, the field turns red. */
  errorText?: string;
};

/** Outlined text field that reserves space for one error line (no layout jump). */
export function AppTextInput({ errorText, ...rest }: AppTextInputProps) {
  return (
    <TextField
      variant="outlined"
      fullWidth
      margin="dense"
      error={Boolean(errorText)}
      helperText={errorText ?? ' '}
      {...rest}
    />
  );
}
