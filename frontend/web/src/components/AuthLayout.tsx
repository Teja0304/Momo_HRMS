import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

/** Centered card used by the Login and Reset Password pages (responsive). */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, sm: 4 },
      }}
    >
      <Card
        elevation={0}
        sx={{ width: '100%', maxWidth: 460, border: '1px solid', borderColor: 'divider' }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>{children}</CardContent>
      </Card>
    </Box>
  );
}
