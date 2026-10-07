import { useEffect, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BadgeIcon from '@mui/icons-material/Badge';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import ComputerIcon from '@mui/icons-material/Computer';
import { useAuth } from '../context/AuthContext';
import { fetchEmployeeByUserId, fetchEmployees } from '../services/employeeService';
import type { Employee } from '../types/employee';
import { ROLE_LABELS } from '../utils/roles';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ProfileDialog({ open, onClose }: Props) {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    let isCancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        // Try resolving employee by userId first
        let emp = await fetchEmployeeByUserId(user!.id);

        // If not directly linked by userId, query by clean email or base username
        if (!emp) {
          const cleanEmail = user!.email.replace(/\.hr(?=@|$)/i, '');
          const res = await fetchEmployees({ search: cleanEmail });
          const list = Array.isArray(res.data) ? res.data : [];
          emp = list.find(
            (e) =>
              e.email?.toLowerCase() === cleanEmail.toLowerCase() ||
              e.email?.toLowerCase() === user!.email.toLowerCase()
          ) || list[0] || null;
        }

        if (!isCancelled) {
          setEmployee(emp);
        }
      } catch {
        // Non-fatal if employee service record isn't found
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isCancelled = true;
    };
  }, [open, user]);

  if (!user) return null;

  const isHr = user.appRole === 'HR' || user.email.toLowerCase().includes('.hr@');
  const hrEmail = user.email;
  const employeeEmail = isHr ? user.email.replace(/\.hr(?=@|$)/i, '') : user.email;

  const initials = (user.fullName || user.username || 'U')
    .split(' ')
    .filter(Boolean)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Account & Profile
        </Typography>
        {user.appRole && (
          <Chip
            size="small"
            label={ROLE_LABELS[user.appRole]}
            color={user.appRole === 'ADMIN' ? 'error' : user.appRole === 'HR' ? 'primary' : 'default'}
            sx={{ fontWeight: 600 }}
          />
        )}
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2 }}>
        {/* User Identity Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Avatar
            sx={{
              width: 56,
              height: 56,
              bgcolor: isHr ? 'primary.main' : user.appRole === 'ADMIN' ? 'error.main' : 'grey.700',
              fontSize: '1.25rem',
              fontWeight: 700,
            }}
          >
            {initials}
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {user.fullName || user.username}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {employee?.jobTitle || (isHr ? 'HR Executive / Administrator' : 'Staff Member')}
            </Typography>
            {employee?.department && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                <BusinessIcon sx={{ fontSize: 14 }} /> {employee.department.name}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Section 16: Account Information Separation */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary', mb: 1.5 }}>
          Account Information
        </Typography>

        <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}>
          {isHr ? (
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <ComputerIcon color="primary" sx={{ mt: 0.2 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    HR FUNCTIONAL ACCOUNT
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700, fontFamily: 'monospace', color: 'primary.main' }}>
                    {hrEmail}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Used for: <strong>HR Web Portal & Employee Management</strong>
                  </Typography>
                </Box>
              </Box>

              <Divider />

              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <SmartphoneIcon color="success" sx={{ mt: 0.2 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    EMPLOYEE ACCOUNT
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                    {employeeEmail}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Used for: <strong>Personal Attendance & Mobile Check-in</strong>
                  </Typography>
                </Box>
              </Box>
            </Stack>
          ) : user.appRole === 'ADMIN' ? (
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <AdminPanelSettingsIcon color="error" sx={{ mt: 0.2 }} />
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  ADMINISTRATOR ACCOUNT
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, fontFamily: 'monospace', color: 'error.main' }}>
                  {user.email}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Used for: <strong>Full System Administration</strong>
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <SmartphoneIcon color="primary" sx={{ mt: 0.2 }} />
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  EMPLOYEE ACCOUNT
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                  {user.email}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Used for: <strong>Employee Attendance & Personal Portal</strong>
                </Typography>
              </Box>
            </Box>
          )}
        </Paper>

        {/* Section 15: Employee Profile Details */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary', mb: 1.5 }}>
          Employee Profile
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <BadgeIcon sx={{ fontSize: 14 }} /> Employee ID
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                  {employee?.employeeCode || 'EMP-HR'}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <BusinessIcon sx={{ fontSize: 14 }} /> Department
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {employee?.department?.name || 'Human Resources'}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <EmailIcon sx={{ fontSize: 14 }} /> Official Email
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-all' }}>
                  {employee?.email || user.email}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PhoneIcon sx={{ fontSize: 14 }} /> Phone
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {employee?.phone || '—'}
                </Typography>
              </Box>

              {employee?.dateOfJoining && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CalendarMonthIcon sx={{ fontSize: 14 }} /> Date of Joining
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {new Date(employee.dateOfJoining).toLocaleDateString()}
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
