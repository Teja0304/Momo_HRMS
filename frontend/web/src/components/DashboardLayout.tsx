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
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import LogoutIcon from '@mui/icons-material/Logout';
import PeopleIcon from '@mui/icons-material/People';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { COMPANY_NAME } from '../config/env';
import { useAuth } from '../context/AuthContext';
import { PATHS, homePathForUser } from '../routes/paths';
import { ROLE_LABELS } from '../utils/roles';

interface Props {
  title: string;
  subtitle: string;
  children?: ReactNode;
}

/** Shared layout of the module pages (top bar, profile, logout, notice). */
export function DashboardLayout({ title, subtitle, children }: Props) {
  const { user, logout, notice, clearNotice } = useAuth();
  const navigate = useNavigate();

  const isManagementUser = user?.appRole === 'ADMIN' || user?.appRole === 'HR';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Toolbar sx={{ gap: 1 }}>
          <Typography
            variant="h6"
            color="primary"
            sx={{ fontWeight: 800, flexGrow: { xs: 1, sm: 0 }, mr: 3, cursor: 'pointer' }}
            onClick={() => navigate(homePathForUser(user))}
          >
            {COMPANY_NAME}
          </Typography>

          {isManagementUser && (
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1, flexGrow: 1 }}>
              <Button
                component={RouterLink}
                to={homePathForUser(user)}
                color="inherit"
                size="small"
                startIcon={<DashboardIcon fontSize="small" />}
              >
                Dashboard
              </Button>
              <Button
                component={RouterLink}
                to={PATHS.employees}
                color="inherit"
                size="small"
                startIcon={<PeopleIcon fontSize="small" />}
              >
                Employees
              </Button>
            </Box>
          )}

          <Box sx={{ ml: 'auto' }}>
            <Button color="inherit" startIcon={<LogoutIcon />} onClick={() => void logout()}>
              Log out
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 4 } }}>
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
