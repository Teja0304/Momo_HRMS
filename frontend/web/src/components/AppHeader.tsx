import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import GroupsIcon from '@mui/icons-material/Groups';
import { COMPANY_NAME } from '../config/env';
import { palette } from '../theme/theme';

interface Props {
  title: string;
  subtitle?: string;
  showLogo?: boolean;
}

/** Logo placeholder + company name + heading. Replace the icon with your real logo. */
export function AppHeader({ title, subtitle, showLogo = true }: Props) {
  return (
    <Box sx={{ mb: 3 }}>
      {showLogo && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 3,
              bgcolor: palette.primary,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <GroupsIcon sx={{ color: '#fff' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {COMPANY_NAME}
          </Typography>
        </Box>
      )}
      <Typography variant="h4" component="h1">
        {title}
      </Typography>
      {subtitle ? (
        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
          {subtitle}
        </Typography>
      ) : null}
    </Box>
  );
}
