import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { palette } from '../theme/theme';
import { evaluatePasswordRules } from '../utils/passwordRules';

interface Props {
  password: string;
}

/**
 * Live checklist. Empty field => every rule is RED.
 * Each rule turns GREEN (with a check) the moment it is satisfied.
 */
export function PasswordRequirements({ password }: Props) {
  const results = useMemo(() => evaluatePasswordRules(password), [password]);

  return (
    <Box component="ul" aria-label="Password requirements" sx={{ listStyle: 'none', m: 0, mb: 2, p: 0 }}>
      {results.map((rule) => {
        const color = rule.passed ? palette.success : palette.error;
        const Icon = rule.passed ? CheckCircleIcon : CancelIcon;
        return (
          <Box component="li" key={rule.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
            <Icon sx={{ fontSize: 18, color }} />
            <Typography variant="body2" sx={{ color }}>
              {rule.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
