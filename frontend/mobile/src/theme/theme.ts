import { MD3LightTheme } from 'react-native-paper';

export const palette = {
  primary: '#1B4B8F',
  ink: '#14213D',
  muted: '#5B6B82',
  background: '#F3F6FA',
  surface: '#FFFFFF',
  border: '#D5DCE6',
  success: '#2E7D32',
  error: '#C62828',
  errorSurface: '#FDECEC',
  infoSurface: '#E8F0FB',
} as const;

export const theme = {
  ...MD3LightTheme,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    primary: palette.primary,
    background: palette.background,
    surface: palette.surface,
    onSurface: palette.ink,
    error: palette.error,
    outline: palette.border,
  },
};
