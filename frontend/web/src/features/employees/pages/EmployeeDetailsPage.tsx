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
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import FaceIcon from '@mui/icons-material/Face';
import RefreshIcon from '@mui/icons-material/Refresh';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { LoadingIndicator } from '../../../components/LoadingIndicator';
import { PATHS } from '../../../routes/paths';
import {
  changeEmployeeStatus,
  fetchEmployeeProfile,
} from '../../../services/employeeService';
import type { EmployeeProfileResponse } from '../../../types/employee';
import { EmployeeStatusBadge } from '../components/EmployeeStatusBadge';

export default function EmployeeDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<EmployeeProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status toggle modal
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const profile = await fetchEmployeeProfile(id);
      setData(profile);
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error?.message
          ? err.response.data.error.message
          : 'Failed to load employee details.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    if (!id) return;

    fetchEmployeeProfile(id)
      .then((profile) => {
        if (active) {
          setData(profile);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const msg =
            axios.isAxiosError(err) && err.response?.data?.error?.message
              ? err.response.data.error.message
              : 'Failed to load employee details.';
          setError(msg);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  const handleStatusToggle = async () => {
    if (!data?.employee) return;
    const nextStatus = data.employee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setStatusSubmitting(true);
    try {
      await changeEmployeeStatus(data.employee.id, {
        status: nextStatus,
        reason: statusReason.trim() || undefined,
      });
      setFeedback(`Employee status successfully changed to ${nextStatus.toLowerCase()}.`);
      setStatusDialogOpen(false);
      setStatusReason('');
      await loadProfile();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) && err.response?.data?.error?.message
        ? err.response.data.error.message
        : 'Failed to update employee status.';
      setError(msg);
    } finally {
      setStatusSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Employee Details" subtitle="Loading profile information...">
        <LoadingIndicator message="Retrieving employee profile..." />
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout title="Employee Details" subtitle="Employee Profile">
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="error" variant="h6" gutterBottom>
            Unable to load employee details
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {error || 'Employee not found.'}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(PATHS.employees)}
            >
              Back to Employee List
            </Button>
            <Button variant="contained" startIcon={<RefreshIcon />} onClick={loadProfile}>
              Retry
            </Button>
          </Box>
        </Paper>
      </DashboardLayout>
    );
  }

  const { employee, devices, faceTemplate } = data;
  const initials = `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase();
  const isActive = employee.status === 'ACTIVE';

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
        <Box sx={{ display: 'flex', gap: 1.5 }}>
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {employee.firstName} {employee.lastName}
              </Typography>
              <EmployeeStatusBadge status={employee.status} size="medium" />
            </Box>
            <Typography variant="body1" color="text.secondary">
              {employee.jobTitle} • {employee.department?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Organization Role: <strong>{employee.role?.name}</strong>
            </Typography>
          </Box>
        </Box>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 3 }}>
        {/* Card 1: Personal Information */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>
              Personal Information
            </Typography>
            <Divider sx={{ my: 1.5 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Email Address</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{employee.email}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Phone Number</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{employee.phone}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Date of Birth</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{employee.dateOfBirth ?? 'Not specified'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Gender</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{employee.gender?.replace('_', ' ') ?? 'Not specified'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Residential Address</Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{employee.address ?? 'Not specified'}</Typography>
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

        {/* Card 3: Registered Attendance Devices */}
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <SmartphoneIcon color="primary" fontSize="small" />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Registered Devices ({devices.length})
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              Hardware registered for mobile/web GPS attendance verification.
            </Typography>
            <Divider sx={{ my: 1.5 }} />

            {devices.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                No registered devices recorded for this employee.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {devices.map((device) => (
                  <Paper key={device.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {device.deviceName}
                      </Typography>
                      <Chip
                        size="small"
                        label={device.status}
                        color={device.status === 'ACTIVE' ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Type: {device.deviceType} • Registered: {device.registeredAt ? new Date(device.registeredAt).toLocaleDateString() : 'N/A'}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Face Template Reference Metadata */}
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <FaceIcon color="primary" fontSize="small" />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Biometric Template Status
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              Biometric metadata reference only. Raw template data is never stored in this service.
            </Typography>
            <Divider sx={{ my: 1.5 }} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Active Reference Status
                </Typography>
                <Chip
                  label={faceTemplate.hasActiveReference ? 'Enrolled & Active' : 'Not Enrolled'}
                  color={faceTemplate.hasActiveReference ? 'success' : 'default'}
                  variant="outlined"
                  size="small"
                />
              </Box>

              {faceTemplate.status && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    Reference State
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {faceTemplate.status}
                  </Typography>
                </Box>
              )}

              <Alert severity="info" sx={{ mt: 1, fontSize: '0.8rem' }}>
                Face verification templates reside inside dedicated biometric recognition systems. Only external identifiers and enrollment statuses are referenced here.
              </Alert>
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
