import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import RefreshIcon from '@mui/icons-material/Refresh';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import ComputerIcon from '@mui/icons-material/Computer';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { LoadingIndicator } from '../../../components/LoadingIndicator';
import { PATHS } from '../../../routes/paths';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../api/client';
import { ATTENDANCE_API_URL } from '../../../config/env';
import {
  changeEmployeeStatus,
  fetchEmployeeProfile,
  resendCredentials,
} from '../../../services/employeeService';
import type { EmployeeProfileResponse } from '../../../types/employee';
import { EmployeeStatusBadge } from '../components/EmployeeStatusBadge';
import { AccountStatusBadge } from '../components/AccountStatusBadge';

function calculateAge(dobString?: string | null): number | null {
  if (!dobString) return null;
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '00h 00m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
}

export default function EmployeeDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.appRole === 'ADMIN';

  const [data, setData] = useState<EmployeeProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status toggle modal
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Attendance Information
  const [todayAttendance, setTodayAttendance] = useState<{
    sessions?: any[];
    totalWorkingSecondsToday?: number;
    hasActiveSession?: boolean;
    attendanceDate?: string;
  } | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  const loadAttendance = useCallback(async (codeOverride?: string) => {
    if (!id) return;
    setLoadingAttendance(true);
    try {
      const targetCode = codeOverride || data?.employee?.employeeCode;
      const primaryId = targetCode || id;

      const [todayRes, historyRes] = await Promise.all([
        api.get(`${ATTENDANCE_API_URL}/today?employeeId=${encodeURIComponent(primaryId)}`).catch(() => null),
        api.get(`${ATTENDANCE_API_URL}/history?employeeId=${encodeURIComponent(primaryId)}&limit=10`).catch(() => null),
      ]);
      let todayData = todayRes?.data?.data || todayRes?.data;
      let historyData = historyRes?.data?.data || historyRes?.data;
      let histItems = historyData?.items || (Array.isArray(historyData) ? historyData : []);

      // If primaryId returned 0 sessions, fallback to employeeCode or id
      const fallbackId = primaryId === id ? targetCode : id;
      if ((!todayData?.sessions || todayData.sessions.length === 0) && fallbackId) {
        const fbToday = await api.get(`${ATTENDANCE_API_URL}/today?employeeId=${encodeURIComponent(fallbackId)}`).catch(() => null);
        if (fbToday?.data) {
          const parsed = fbToday.data?.data || fbToday.data;
          if (parsed?.sessions?.length > 0) todayData = parsed;
        }
      }
      if (histItems.length === 0 && fallbackId) {
        const fbHist = await api.get(`${ATTENDANCE_API_URL}/history?employeeId=${encodeURIComponent(fallbackId)}&limit=10`).catch(() => null);
        if (fbHist?.data) {
          const parsed = fbHist.data?.data || fbHist.data;
          const items = parsed?.items || (Array.isArray(parsed) ? parsed : []);
          if (items.length > 0) histItems = items;
        }
      }

      if (todayData) {
        setTodayAttendance(todayData);
      }
      if (histItems) {
        setAttendanceHistory(histItems);
      }
    } catch {
      // Attendance query failure should not break profile view
    } finally {
      setLoadingAttendance(false);
    }
  }, [id, data?.employee?.employeeCode]);

  const loadProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const profile = await fetchEmployeeProfile(id);
      setData(profile);
      if (profile?.employee?.employeeCode) {
        void loadAttendance(profile.employee.employeeCode);
      } else {
        void loadAttendance();
      }
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error?.message
          ? err.response.data.error.message
          : 'Failed to load employee details.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id, loadAttendance]);

  const handleResend = async () => {
    if (!id) return;
    setResending(true);
    try {
      const res = await resendCredentials(id);
      setFeedback(res.message || `Credentials sent to ${res.deliveredTo}`);
      loadProfile();
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error?.message
          ? err.response.data.error.message
          : 'Failed to dispatch credentials.';
      setError(msg);
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleStatusToggle = async () => {
    if (!data) return;
    setStatusSubmitting(true);
    const nextStatus = data.employee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await changeEmployeeStatus(data.employee.id, {
        status: nextStatus,
        reason: statusReason || undefined,
      });
      setStatusDialogOpen(false);
      setStatusReason('');
      setFeedback(`Employee status successfully updated to ${nextStatus}.`);
      loadProfile();
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error?.message
          ? err.response.data.error.message
          : 'Failed to update employee status.';
      setError(msg);
    } finally {
      setStatusSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Employee Details" subtitle="Loading profile...">
        <LoadingIndicator message="Retrieving employee profile..." />
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout title="Employee Details" subtitle="Error loading profile">
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error || 'Employee not found.'}
          </Alert>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(PATHS.employees)}
            >
              Back to Employee List
            </Button>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={loadProfile}
            >
              Retry
            </Button>
          </Box>
        </Paper>
      </DashboardLayout>
    );
  }

  const { employee } = data;
  const initials = `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase();
  const isActive = employee.status === 'ACTIVE';
  const age = calculateAge(employee.dateOfBirth);

  const isProfileComplete = Boolean(
    employee.dateOfBirth &&
    employee.gender &&
    employee.phone &&
    employee.address &&
    employee.personalEmail
  );

  // Compute today's attendance display
  const todaySessions = todayAttendance?.sessions || [];
  const latestSession = todaySessions[todaySessions.length - 1];
  const hasCheckedInToday = todaySessions.length > 0;
  const isWorkingNow = latestSession?.status === 'WORKING';
  const isPausedNow = latestSession?.status === 'PAUSED';
  const isCheckedOutToday = latestSession?.status === 'CHECKED_OUT' || latestSession?.status === 'AUTO_CHECKED_OUT';
  const todayStatusLabel = isWorkingNow
    ? 'Working (Inside Office)'
    : isPausedNow
    ? 'Paused (Outside Office)'
    : isCheckedOutToday
    ? 'Checked Out'
    : 'Not Checked In';
  const todayStatusColor = isWorkingNow ? 'success' : isPausedNow ? 'warning' : isCheckedOutToday ? 'info' : 'default';

  return (
    <DashboardLayout
      title={`${employee.firstName} ${employee.lastName}`}
      subtitle={`Employee Code: ${employee.employeeCode}`}
    >
      {/* Navigation & Header Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          color="inherit"
          onClick={() => navigate(PATHS.employees)}
        >
          Back to Employee List
        </Button>
        {isAdmin && (
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<VpnKeyOutlinedIcon />}
              disabled={resending}
              onClick={handleResend}
            >
              {resending ? 'Sending...' : 'Resend Credentials'}
            </Button>
            <Button
              variant="outlined"
              color={isActive ? 'error' : 'success'}
              startIcon={isActive ? <BlockIcon /> : <CheckCircleIcon />}
              onClick={() => setStatusDialogOpen(true)}
            >
              {isActive ? 'Deactivate' : 'Activate'}
            </Button>
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => navigate(PATHS.editEmployee(employee.id))}
            >
              Edit Profile
            </Button>
          </Box>
        )}
      </Box>

      {/* Profile Overview Card */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
          <Avatar
            src={employee.profilePhotoUrl ?? undefined}
            sx={{ width: 72, height: 72, bgcolor: 'primary.main', fontSize: '1.75rem', fontWeight: 700 }}
          >
            {initials}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {employee.firstName} {employee.lastName}
              </Typography>
              <EmployeeStatusBadge status={employee.status} size="medium" />
              <Chip
                label={isProfileComplete ? 'Profile Complete' : 'Profile Incomplete'}
                color={isProfileComplete ? 'success' : 'warning'}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
              <AccountStatusBadge
                hasAccount={Boolean(employee.userId || employee.hasAccount)}
                credentialsSentAt={employee.credentialsSentAt}
                size="medium"
              />
            </Box>
            <Typography variant="body1" color="text.secondary">
              {employee.jobTitle} • {employee.department?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Organization Role: <strong>{employee.role?.name}</strong>
              {(employee.assignedOffices || []).length > 0 ? (
                <>
                  {' '}• Assigned Offices:
                  <Box component="span" sx={{ display: 'inline-flex', flexWrap: 'wrap', gap: 0.5, ml: 1, verticalAlign: 'middle' }}>
                    {employee.assignedOffices!.map((o) => (
                      <Chip
                        key={o.id}
                        label={`📍 ${o.name} (${o.code})${o.isPrimary ? ' [Primary]' : ''}`}
                        size="small"
                        color={o.isPrimary ? 'primary' : 'default'}
                        variant={o.isPrimary ? 'filled' : 'outlined'}
                        sx={{ fontWeight: 600, fontSize: '0.75rem', height: 22 }}
                      />
                    ))}
                  </Box>
                </>
              ) : employee.officeLocationName ? (
                <> • Assigned Office: <strong style={{ color: '#1976d2' }}>📍 {employee.officeLocationName}</strong></>
              ) : null}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* HR Multi-Account Information */}
      {Boolean(employee.role?.name?.toUpperCase().includes('HR') || employee.email.includes('.hr@')) && (
        <Card
          variant="outlined"
          sx={{
            mb: 3,
            borderColor: 'secondary.main',
            borderWidth: 1.5,
            bgcolor: 'rgba(156, 39, 176, 0.03)',
          }}
        >
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <SupervisorAccountIcon color="secondary" />
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'secondary.dark' }}>
                HR Staff Member — Dual Company Accounts
              </Typography>
              <Chip label="Accounts: 2" color="secondary" size="small" sx={{ fontWeight: 700 }} />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This staff member maintains separate accounts for administrative web management and daily attendance tracking:
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <ComputerIcon color="secondary" fontSize="small" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    1. HR Functional Account
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Used for: HR Web Portal (Employee Directory, Onboarding, Analytics)
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', color: 'secondary.main' }}>
                  {employee.email}
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <SmartphoneIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    2. Employee Attendance Account
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Used for: Employee Attendance (Mobile App Check-in / Check-out)
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', color: 'primary.main' }}>
                  {employee.email.includes('.hr') ? employee.email.replace(/\.hr([0-9]*?)@/, '$1@') : employee.email}
                </Typography>
              </Paper>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Attendance Summary Section */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <AccessTimeIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Attendance & Time Logs
              </Typography>
              {loadingAttendance ? (
                <CircularProgress size={16} />
              ) : (
                <IconButton
                  size="small"
                  onClick={() => loadAttendance(data?.employee?.employeeCode)}
                  title="Refresh Attendance Logs"
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
            <Chip
              label={`Today: ${todayStatusLabel}`}
              color={todayStatusColor as any}
              sx={{ fontWeight: 700 }}
            />
          </Box>
          <Divider sx={{ mb: 2 }} />
 
          {isPausedNow && (
            <Alert
              severity="warning"
              variant="outlined"
              sx={{ mb: 2, alignItems: 'center' }}
            >
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Attendance Session Currently Paused (Outside Office Boundary)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Employee has exited the assigned office geofence. Working hours are paused.
                  {latestSession?.currentGraceDeadline && (
                    <> Auto-checkout grace deadline: <strong>{new Date(latestSession.currentGraceDeadline).toLocaleTimeString()}</strong>.</>
                  )}
                </Typography>
              </Box>
            </Alert>
          )}

          {/* Today's Metrics */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
              <Typography variant="caption" color="text.secondary">Today's Check-In</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {latestSession?.checkInAt ? new Date(latestSession.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
              <Typography variant="caption" color="text.secondary">Today's Check-Out</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {latestSession?.checkOutAt ? new Date(latestSession.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
              <Typography variant="caption" color="text.secondary">Working Hours Today</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {formatDuration(todayAttendance?.totalWorkingSecondsToday ?? latestSession?.totalWorkingSeconds ?? 0)}
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
              <Typography variant="caption" color="text.secondary">Punctuality</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {latestSession?.checkInStatus?.replace('_', ' ') || (hasCheckedInToday ? 'On Time' : '—')}
              </Typography>
            </Paper>
          </Box>

          {/* Recent Attendance History Table */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon fontSize="small" color="action" />
            Recent Attendance Records
          </Typography>
          {attendanceHistory.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No previous attendance records logged for this employee.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Check-In</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Check-Out</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Working Duration</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {attendanceHistory.map((sess) => (
                    <TableRow key={sess.id}>
                      <TableCell>{sess.attendanceDate ? String(sess.attendanceDate).slice(0, 10) : '—'}</TableCell>
                      <TableCell>{sess.checkInAt ? new Date(sess.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</TableCell>
                      <TableCell>{sess.checkOutAt ? new Date(sess.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{formatDuration(sess.totalWorkingSeconds)}</TableCell>
                      <TableCell>
                        <Chip
                          label={
                            sess.status === 'WORKING'
                              ? 'Working'
                              : sess.status === 'PAUSED'
                              ? 'Paused'
                              : sess.status === 'CHECKED_OUT'
                              ? 'Checked Out'
                              : sess.status?.replace('_', ' ')
                          }
                          size="small"
                          color={
                            sess.status === 'WORKING'
                              ? 'success'
                              : sess.status === 'PAUSED'
                              ? 'warning'
                              : 'default'
                          }
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 3 }}>
        {/* Card 1: Personal & Account Information */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>
              Personal & Account Information
            </Typography>
            <Divider sx={{ my: 1.5 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Full Legal Name</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{employee.firstName} {employee.lastName}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Official Login Email (Company)</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>{employee.email}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Personal Email (Credential Delivery)</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{employee.personalEmail || 'Not specified'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Credentials Last Sent</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {employee.credentialsSentAt ? new Date(employee.credentialsSentAt).toLocaleString() : 'Not dispatched yet'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Phone Number</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{employee.phone}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Date of Birth & Calculated Age</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {employee.dateOfBirth
                    ? `${employee.dateOfBirth} (${age !== null ? `${age} years old` : 'Age unavailable'})`
                    : 'Not specified'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Gender</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{employee.gender?.replace('_', ' ') ?? 'Not specified'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Residential Address</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{employee.address ?? 'Not specified'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Emergency Contact</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {employee.phone ? `${employee.phone} (Primary Phone)` : employee.personalEmail || 'Not specified'}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Card 2: Employment Details */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>
              Employment Details
            </Typography>
            <Divider sx={{ my: 1.5 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Employee Code</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{employee.employeeCode}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Department</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {employee.department?.name} ({employee.department?.code})
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Designation / Job Title</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{employee.jobTitle}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Date of Joining</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{employee.dateOfJoining}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Assigned Workplaces (Multi-Location Access)</Typography>
                {(employee.assignedOffices || []).length > 0 ? (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                    {employee.assignedOffices!.map((o) => (
                      <Chip
                        key={o.id}
                        label={`📍 ${o.name} (${o.code})${o.isPrimary ? ' • Primary Workplace' : ''}`}
                        size="small"
                        color={o.isPrimary ? 'primary' : 'default'}
                        variant={o.isPrimary ? 'filled' : 'outlined'}
                        sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                      />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {employee.officeLocationName || 'Not assigned'}
                  </Typography>
                )}
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Account Created</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {new Date(employee.createdAt).toLocaleDateString()}
                </Typography>
              </Box>
              {employee.deactivatedAt && (
                <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="caption" color="error.main" sx={{ fontWeight: 600 }}>
                    Deactivated on {new Date(employee.deactivatedAt).toLocaleDateString()}
                  </Typography>
                  {employee.deactivationReason && (
                    <Typography variant="body2" color="text.secondary">
                      Reason: {employee.deactivationReason}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Confirmation Dialog for Status Change */}
      <Dialog
        open={statusDialogOpen}
        onClose={() => !statusSubmitting && setStatusDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {isActive ? 'Deactivate Employee' : 'Activate Employee'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {isActive
              ? `Are you sure you want to deactivate ${employee.firstName} ${employee.lastName}? They will no longer be eligible for attendance tracking or active operations.`
              : `Are you sure you want to reactivate ${employee.firstName} ${employee.lastName}? Their employment status will be restored to ACTIVE.`}
          </DialogContentText>

          {isActive && (
            <TextField
              label="Deactivation Reason (Optional)"
              multiline
              rows={2}
              fullWidth
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="e.g. Resignation, leaves, contract completion..."
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setStatusDialogOpen(false)} color="inherit" disabled={statusSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleStatusToggle}
            color={isActive ? 'error' : 'success'}
            variant="contained"
            disabled={statusSubmitting}
          >
            {statusSubmitting ? 'Updating...' : isActive ? 'Confirm Deactivation' : 'Confirm Activation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feedback Snackbar */}
      <Snackbar open={Boolean(feedback)} autoHideDuration={4000} onClose={() => setFeedback(null)}>
        <Alert severity="success" onClose={() => setFeedback(null)} variant="filled">
          {feedback}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
