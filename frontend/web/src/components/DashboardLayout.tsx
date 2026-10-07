import { useState, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import NotificationsIcon from '@mui/icons-material/Notifications';
import LogoutIcon from '@mui/icons-material/Logout';
import PeopleIcon from '@mui/icons-material/People';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { COMPANY_NAME } from '../config/env';
import { useAuth } from '../context/AuthContext';
import { PATHS, homePathForUser } from '../routes/paths';
import { ROLE_LABELS } from '../utils/roles';
import { ProfileDialog } from './ProfileDialog';

interface Props {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  hideUserCard?: boolean;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  noHeader?: boolean;
}

/** Shared layout of the module pages (top horizontal bar, profile, logout, notice). */
export function DashboardLayout({
  title,
  subtitle,
  children,
  hideUserCard = false,
  maxWidth = 'lg',
  noHeader = false,
}: Props) {
  const { user, logout, notice, clearNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isManagementUser = user?.appRole === 'ADMIN' || user?.appRole === 'HR';
  const isHr = user?.appRole === 'HR';
  const isAdmin = user?.appRole === 'ADMIN';
  const isEmployee = user?.appRole === 'EMPLOYEE';

  const pathname = location.pathname;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Upper Horizontal Navigation Bar */}
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: '#ffffff',
          top: 0,
          zIndex: 1100,
        }}
      >
        <Toolbar sx={{ gap: 1, px: { xs: 2, sm: 3 } }}>
          {/* Logo / Brand Name - matches Image 1 exactly */}
          <Typography
            variant="h6"
            color="primary"
            sx={{
              fontWeight: 800,
              letterSpacing: -0.2,
              fontSize: '1.25rem',
              cursor: 'pointer',
              mr: { xs: 2, md: 3 },
            }}
            onClick={() => navigate(homePathForUser(user))}
          >
            {COMPANY_NAME}
          </Typography>

          {/* Upper Horizontal Layer: Navigation Links */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, flexGrow: 1, alignItems: 'center' }}>
            {/* 1. Main Dashboard Link */}
            {isAdmin ? (
              <Button
                component={RouterLink}
                to={PATHS.admin}
                size="small"
                startIcon={<DashboardIcon sx={{ fontSize: 18 }} />}
                sx={{
                  fontWeight: pathname === PATHS.admin || pathname === '/' || pathname === '/dashboard' ? 700 : 500,
                  color: pathname === PATHS.admin || pathname === '/' || pathname === '/dashboard' ? '#1B4B8F' : 'text.primary',
                  bgcolor: pathname === PATHS.admin || pathname === '/' || pathname === '/dashboard' ? 'rgba(27, 75, 143, 0.08)' : 'transparent',
                  borderRadius: 2,
                  px: 1.5,
                  '&:hover': {
                    bgcolor: 'rgba(27, 75, 143, 0.05)',
                  },
                }}
              >
                Admin Dashboard
              </Button>
            ) : isHr ? (
              <Button
                component={RouterLink}
                to={PATHS.hr}
                size="small"
                startIcon={<DashboardIcon sx={{ fontSize: 18 }} />}
                sx={{
                  fontWeight: pathname === PATHS.hr || pathname === '/' || pathname === '/dashboard' ? 700 : 500,
                  color: pathname === PATHS.hr || pathname === '/' || pathname === '/dashboard' ? '#1B4B8F' : 'text.primary',
                  bgcolor: pathname === PATHS.hr || pathname === '/' || pathname === '/dashboard' ? 'rgba(27, 75, 143, 0.08)' : 'transparent',
                  borderRadius: 2,
                  px: 1.5,
                  '&:hover': {
                    bgcolor: 'rgba(27, 75, 143, 0.05)',
                  },
                }}
              >
                Dashboard
              </Button>
            ) : (
              <Button
                component={RouterLink}
                to={homePathForUser(user)}
                size="small"
                startIcon={<DashboardIcon sx={{ fontSize: 18 }} />}
                sx={{
                  fontWeight: pathname === homePathForUser(user) || pathname === '/' || pathname === '/dashboard' ? 700 : 500,
                  color: pathname === homePathForUser(user) || pathname === '/' || pathname === '/dashboard' ? '#1B4B8F' : 'text.primary',
                  bgcolor: pathname === homePathForUser(user) || pathname === '/' || pathname === '/dashboard' ? 'rgba(27, 75, 143, 0.08)' : 'transparent',
                  borderRadius: 2,
                  px: 1.5,
                  '&:hover': {
                    bgcolor: 'rgba(27, 75, 143, 0.05)',
                  },
                }}
              >
                Dashboard
              </Button>
            )}

            {/* 2. For Admin: Link to HR Live Dashboard */}
            {isAdmin && (
              <Button
                component={RouterLink}
                to={PATHS.hr}
                size="small"
                startIcon={<AssessmentIcon sx={{ fontSize: 18 }} />}
                sx={{
                  fontWeight: pathname === PATHS.hr ? 700 : 500,
                  color: pathname === PATHS.hr ? '#1B4B8F' : 'text.primary',
                  bgcolor: pathname === PATHS.hr ? 'rgba(27, 75, 143, 0.08)' : 'transparent',
                  borderRadius: 2,
                  px: 1.5,
                  '&:hover': {
                    bgcolor: 'rgba(27, 75, 143, 0.05)',
                  },
                }}
              >
                HR Dashboard
              </Button>
            )}

            {/* 3. Employees Link */}
            {isManagementUser && (
              <Button
                component={RouterLink}
                to={PATHS.employees}
                size="small"
                startIcon={<PeopleIcon sx={{ fontSize: 18 }} />}
                sx={{
                  fontWeight: pathname.startsWith('/admin/employees') ? 700 : 500,
                  color: pathname.startsWith('/admin/employees') ? '#1B4B8F' : 'text.primary',
                  bgcolor: pathname.startsWith('/admin/employees') ? 'rgba(27, 75, 143, 0.08)' : 'transparent',
                  borderRadius: 2,
                  px: 1.5,
                  '&:hover': {
                    bgcolor: 'rgba(27, 75, 143, 0.05)',
                  },
                }}
              >
                Employees
              </Button>
            )}

            {/* 4. Attendance Link (Employees only - Admin and HR do not use employee punch dashboard) */}
            {isEmployee && (
              <Button
                component={RouterLink}
                to={PATHS.attendance}
                size="small"
                startIcon={<AccessTimeIcon sx={{ fontSize: 18 }} />}
                sx={{
                  fontWeight: pathname === PATHS.attendance ? 700 : 500,
                  color: pathname === PATHS.attendance ? '#1B4B8F' : 'text.primary',
                  bgcolor: pathname === PATHS.attendance ? 'rgba(27, 75, 143, 0.08)' : 'transparent',
                  borderRadius: 2,
                  px: 1.5,
                  '&:hover': {
                    bgcolor: 'rgba(27, 75, 143, 0.05)',
                  },
                }}
              >
                Attendance
              </Button>
            )}

            {/* 5. Geofences (Locations) Link - Admin only */}
            {isAdmin && (
              <Button
                component={RouterLink}
                to={PATHS.geofences}
                size="small"
                startIcon={<LocationOnIcon sx={{ fontSize: 18 }} />}
                sx={{
                  fontWeight: pathname.startsWith('/geofences') ? 700 : 500,
                  color: pathname.startsWith('/geofences') ? '#1B4B8F' : 'text.primary',
                  bgcolor: pathname.startsWith('/geofences') ? 'rgba(27, 75, 143, 0.08)' : 'transparent',
                  borderRadius: 2,
                  px: 1.5,
                  '&:hover': {
                    bgcolor: 'rgba(27, 75, 143, 0.05)',
                  },
                }}
              >
                Geofences
              </Button>
            )}

            {/* 6. Reports Link */}
            {isManagementUser && (
              <Button
                component={RouterLink}
                to={PATHS.attendanceReports}
                size="small"
                startIcon={<AssessmentIcon sx={{ fontSize: 18 }} />}
                sx={{
                  fontWeight: pathname === PATHS.attendanceReports ? 700 : 500,
                  color: pathname === PATHS.attendanceReports ? '#1B4B8F' : 'text.primary',
                  bgcolor: pathname === PATHS.attendanceReports ? 'rgba(27, 75, 143, 0.08)' : 'transparent',
                  borderRadius: 2,
                  px: 1.5,
                  '&:hover': {
                    bgcolor: 'rgba(27, 75, 143, 0.05)',
                  },
                }}
              >
                Reports
              </Button>
            )}

            {/* 7. Notifications Link */}
            <Button
              component={RouterLink}
              to={PATHS.notifications}
              size="small"
              startIcon={<NotificationsIcon sx={{ fontSize: 18 }} />}
              sx={{
                fontWeight: pathname.startsWith('/notifications') ? 700 : 500,
                color: pathname.startsWith('/notifications') ? '#1B4B8F' : 'text.primary',
                bgcolor: pathname.startsWith('/notifications') ? 'rgba(27, 75, 143, 0.08)' : 'transparent',
                borderRadius: 2,
                px: 1.5,
                '&:hover': {
                  bgcolor: 'rgba(27, 75, 143, 0.05)',
                },
              }}
            >
              Notifications
            </Button>
          </Box>

          {/* Right Navigation Actions */}
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Tooltip title="View Profile & Account Details">
              <Button
                color="inherit"
                size="small"
                startIcon={<AccountCircleIcon sx={{ fontSize: 18 }} />}
                onClick={() => setProfileOpen(true)}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, display: { xs: 'none', sm: 'inline-flex' } }}
              >
                Profile
              </Button>
            </Tooltip>

            <Button
              color="inherit"
              size="small"
              startIcon={<LogoutIcon sx={{ fontSize: 18 }} />}
              onClick={() => void logout()}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, display: { xs: 'none', sm: 'inline-flex' } }}
            >
              Log out
            </Button>

            {/* Mobile Hamburger Menu Icon Button */}
            <IconButton
              color="inherit"
              edge="end"
              onClick={() => setMobileMenuOpen(true)}
              sx={{ display: { xs: 'flex', md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Navigation Drawer */}
      <Drawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 280,
            p: 2.5,
            bgcolor: '#ffffff',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" color="primary" sx={{ fontWeight: 800 }}>
            {COMPANY_NAME}
          </Typography>
          <IconButton size="small" onClick={() => setMobileMenuOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Divider sx={{ mb: 2 }} />

        <List sx={{ p: 0 }}>
          {/* 1. Dashboard */}
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              component={RouterLink}
              to={isAdmin ? PATHS.admin : isHr ? PATHS.hr : homePathForUser(user)}
              onClick={() => setMobileMenuOpen(false)}
              selected={pathname === (isAdmin ? PATHS.admin : isHr ? PATHS.hr : homePathForUser(user)) || pathname === '/'}
              sx={{ borderRadius: 2 }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: '#1B4B8F' }}>
                <DashboardIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={isAdmin ? 'Admin Dashboard' : 'Dashboard'} />
            </ListItemButton>
          </ListItem>

          {/* 2. HR Dashboard (if Admin) */}
          {isAdmin && (
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={RouterLink}
                to={PATHS.hr}
                onClick={() => setMobileMenuOpen(false)}
                selected={pathname === PATHS.hr}
                sx={{ borderRadius: 2 }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: '#1B4B8F' }}>
                  <AssessmentIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="HR Dashboard" />
              </ListItemButton>
            </ListItem>
          )}

          {/* 3. Employees */}
          {isManagementUser && (
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={RouterLink}
                to={PATHS.employees}
                onClick={() => setMobileMenuOpen(false)}
                selected={pathname.startsWith('/admin/employees')}
                sx={{ borderRadius: 2 }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: '#1B4B8F' }}>
                  <PeopleIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Employees" />
              </ListItemButton>
            </ListItem>
          )}

          {/* 4. Attendance (Employees only) */}
          {isEmployee && (
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={RouterLink}
                to={PATHS.attendance}
                onClick={() => setMobileMenuOpen(false)}
                selected={pathname === PATHS.attendance}
                sx={{ borderRadius: 2 }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: '#1B4B8F' }}>
                  <AccessTimeIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Attendance" />
              </ListItemButton>
            </ListItem>
          )}

          {/* 5. Geofences (Admin only) */}
          {isAdmin && (
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={RouterLink}
                to={PATHS.geofences}
                onClick={() => setMobileMenuOpen(false)}
                selected={pathname.startsWith('/geofences')}
                sx={{ borderRadius: 2 }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: '#1B4B8F' }}>
                  <LocationOnIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Geofences" />
              </ListItemButton>
            </ListItem>
          )}

          {/* 6. Reports */}
          {isManagementUser && (
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={RouterLink}
                to={PATHS.attendanceReports}
                onClick={() => setMobileMenuOpen(false)}
                selected={pathname === PATHS.attendanceReports}
                sx={{ borderRadius: 2 }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: '#1B4B8F' }}>
                  <AssessmentIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Reports" />
              </ListItemButton>
            </ListItem>
          )}

          {/* 7. Notifications */}
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              component={RouterLink}
              to={PATHS.notifications}
              onClick={() => setMobileMenuOpen(false)}
              selected={pathname.startsWith('/notifications')}
              sx={{ borderRadius: 2 }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: '#1B4B8F' }}>
                <NotificationsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Notifications" />
            </ListItemButton>
          </ListItem>
        </List>

        <Divider sx={{ my: 2 }} />

        <List sx={{ p: 0 }}>
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => {
                setMobileMenuOpen(false);
                setProfileOpen(true);
              }}
              sx={{ borderRadius: 2 }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: '#64748b' }}>
                <AccountCircleIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Profile" />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            <ListItemButton
              onClick={() => {
                setMobileMenuOpen(false);
                void logout();
              }}
              sx={{ borderRadius: 2 }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: '#dc2626' }}>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Log out" sx={{ color: '#dc2626' }} />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>

      {/* Profile Modal */}
      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* Main Page Container */}
      <Container maxWidth={maxWidth} sx={{ py: { xs: 2.5, sm: 3.5 } }}>
        {!noHeader && (title || subtitle) && (
          <Box sx={{ mb: hideUserCard ? 3 : 2 }}>
            {title && (
              <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        )}

        {!hideUserCard && user && (
          <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {user.fullName ?? user.username}
            </Typography>
            <Typography color="text.secondary">{user.email}</Typography>
            {user.appRole ? (
              <Chip
                sx={{ mt: 1.5, fontWeight: 700 }}
                size="small"
                label={ROLE_LABELS[user.appRole]}
                color="primary"
              />
            ) : null}
          </Paper>
        )}

        {children}
      </Container>

      {/* Global Notice Toast */}
      <Snackbar open={Boolean(notice)} autoHideDuration={4000} onClose={clearNotice}>
        <Alert severity="success" onClose={clearNotice} variant="filled">
          {notice}
        </Alert>
      </Snackbar>
    </Box>
  );
}
