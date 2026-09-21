import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

interface Props {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingIndicator({ message, fullScreen = false }: Props) {
  return (
    <Box
      role="status"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        p: 2,
        minHeight: fullScreen ? '100vh' : undefined,
      }}
    >
      <CircularProgress />
      {message ? <Typography color="text.secondary">{message}</Typography> : null}
    </Box>
  );
}
