import type { ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import LogoutIcon from '@mui/icons-material/Logout';
import { COMPANY_NAME } from '../config/env';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../utils/roles';

interface Props {
  title: string;
  subtitle: string;
  children?: ReactNode;
}

/** Shared layout of the three module home pages (top bar, profile, logout, notice). */
export function DashboardLayout({ title, subtitle, children }: Props) {
  const { user, logout, notice, clearNotice } = useAuth();

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar>
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
            {COMPANY_NAME}
          </Typography>
          <Button color="inherit" startIcon={<LogoutIcon />} onClick={() => void logout()}>
            Log out
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: { xs: 3, sm: 5 } }}>
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          {subtitle}
        </Typography>

        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6">{user?.fullName ?? user?.username}</Typography>
          <Typography color="text.secondary">{user?.email}</Typography>
          {user?.appRole ? <Chip sx={{ mt: 2 }} label={ROLE_LABELS[user.appRole]} color="primary" /> : null}
        </Paper>

        {children}
      </Container>

      <Snackbar open={Boolean(notice)} autoHideDuration={4000} onClose={clearNotice}>
        <Alert severity="success" onClose={clearNotice} variant="filled">
          {notice}
        </Alert>
      </Snackbar>
    </Box>
  );
}
