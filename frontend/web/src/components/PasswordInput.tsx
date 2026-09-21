import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { AppTextInput } from './AppTextInput';
import type { AppTextInputProps } from './AppTextInput';

type Props = Omit<AppTextInputProps, 'type' | 'slotProps'>;

/** Password field with a show / hide eye button. */
export function PasswordInput(props: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <AppTextInput
      autoComplete="current-password"
      {...props}
      type={visible ? 'text' : 'password'}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                edge="end"
                onClick={() => setVisible((current) => !current)}
                onMouseDown={(event) => event.preventDefault()}
                aria-label={visible ? 'Hide password' : 'Show password'}
              >
                {visible ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
