import { createTheme } from '@mui/material/styles';

export const palette = {
  primary: '#1B4B8F',
  ink: '#14213D',
  muted: '#5B6B82',
  background: '#F3F6FA',
  surface: '#FFFFFF',
  border: '#D5DCE6',
  success: '#2E7D32',
  error: '#C62828',
} as const;

export const theme = createTheme({
  palette: {
    primary: { main: palette.primary },
    error: { main: palette.error },
    success: { main: palette.success },
    background: { default: palette.background, paper: palette.surface },
    text: { primary: palette.ink, secondary: palette.muted },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Manrope", "Segoe UI", system-ui, -apple-system, sans-serif',
    h4: { fontWeight: 800 },
    h5: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: { styleOverrides: { root: { minHeight: 48 } } },
  },
});
