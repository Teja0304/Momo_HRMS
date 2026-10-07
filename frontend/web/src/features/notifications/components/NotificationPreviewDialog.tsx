import { useState, useEffect } from 'react';
import Alert from '@mui/material/Alert';
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
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import type { AppNotification } from '../types/notification';
import { NotificationTypeBadge } from './NotificationTypeBadge';
import { approveAttendanceException } from '../../attendance/services/attendanceService';

interface Props {
  open: boolean;
  notification: AppNotification | null;
  onClose: () => void;
  onMarkRead: (notification: AppNotification) => void;
  onActionComplete?: () => void;
}

export function NotificationPreviewDialog({
  open,
  notification,
  onClose,
  onMarkRead,
  onActionComplete,
}: Props) {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [exceptionStatus, setExceptionStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  useEffect(() => {
    const rawStatus = (notification?.metadata as Record<string, any> | undefined)?.status;
    if (rawStatus === 'APPROVED' || rawStatus === 'REJECTED' || rawStatus === 'PENDING') {
      setExceptionStatus(rawStatus);
    } else {
      setExceptionStatus('PENDING');
    }
    setActionError(null);
    setActionSuccess(null);
    setActionLoading(false);
  }, [notification]);

  if (!notification) return null;

  const metadata = (notification.metadata || {}) as Record<string, any>;
  const isSpecialHoursRequest =
    notification.type === ('SPECIAL_WORKING_HOURS_REQUEST' as any) ||
    Boolean(metadata.exceptionId) ||
    metadata.additionalHours !== undefined;

  const exceptionId = String(metadata.exceptionId || '');
  const employeeName = String(metadata.employeeName || 'Employee');
  const employeeEmail = String(metadata.employeeEmail || '');
  const employeeId = String(metadata.employeeId || '');
  const dateStr = String(metadata.attendanceDate || metadata.dateStr || '');
  const additionalHours = Number(metadata.additionalHours) || (Number(metadata.additionalMinutes) ? Number(metadata.additionalMinutes) / 60 : 0);
  const reason = String(metadata.reason || notification.body || '');
  const hrEmail = String(metadata.hrEmail || '');

  const handleAction = async (status: 'APPROVED' | 'REJECTED') => {
    if (!exceptionId) {
      setActionError('Exception request ID not found in notification metadata.');
      return;
    }

    try {
      setActionLoading(true);
      setActionError(null);
      await approveAttendanceException(exceptionId, {
        status,
        comment: `Handled via Web Notification Center by HR on ${new Date().toLocaleString()}`,
      });

      setExceptionStatus(status);
      setActionSuccess(
        status === 'APPROVED'
          ? `Special working hours (+${additionalHours}h) approved and credited to ${employeeName} for ${dateStr}.`
          : `Special working hours request rejected for ${employeeName}.`,
      );

      // Auto-mark notification as read
      if (!notification.isRead) {
        onMarkRead(notification);
      }

      if (onActionComplete) {
        onActionComplete();
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        `Failed to ${status.toLowerCase()} request. Please try again.`;
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <NotificationTypeBadge type={notification.type} />
          <Typography variant="caption" color="text.secondary">
            {new Date(notification.createdAt).toLocaleString()}
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
          {notification.title}
        </Typography>

        {isSpecialHoursRequest ? (
          <Box sx={{ mb: 2 }}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'primary.light',
                bgcolor: 'primary.50',
                background: 'linear-gradient(135deg, rgba(238, 242, 255, 0.6) 0%, rgba(224, 231, 255, 0.4) 100%)',
              }}
            >
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.dark' }}>
                  SPECIAL WORKING-HOURS APPLICATION
                </Typography>
                <Chip
                  size="small"
                  label={exceptionStatus}
                  color={
                    exceptionStatus === 'APPROVED'
                      ? 'success'
                      : exceptionStatus === 'REJECTED'
                      ? 'error'
                      : 'warning'
                  }
                  sx={{ fontWeight: 700, fontSize: 11 }}
                />
              </Stack>

              <Stack spacing={1} sx={{ fontSize: 13 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <PersonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2">
                    <strong>Employee:</strong> {employeeName} ({employeeId || 'ID Pending'})
                  </Typography>
                </Stack>

                {employeeEmail ? (
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      <strong>Employee Email:</strong> {employeeEmail}
                    </Typography>
                  </Stack>
                ) : null}

                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2">
                    <strong>Applicable Date:</strong> {dateStr || 'Today'}
                  </Typography>
                </Stack>

                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <ScheduleIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                  <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 700 }}>
                    <strong>Requested Additional Hours:</strong> +{additionalHours}h ({Math.round(additionalHours * 60)} mins)
                  </Typography>
                </Stack>

                {hrEmail ? (
                  <Typography variant="caption" color="text.secondary">
                    Sent to HR: {hrEmail}
                  </Typography>
                ) : null}

                <Divider sx={{ my: 1 }} />

                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                    Reason / Genuine Situation Message:
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      bgcolor: 'background.paper',
                      borderRadius: 1.5,
                      fontStyle: 'italic',
                      color: 'text.primary',
                    }}
                  >
                    "{reason}"
                  </Paper>
                </Box>
              </Stack>
            </Paper>

            {actionError ? (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
                {actionError}
              </Alert>
            ) : null}

            {actionSuccess ? (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setActionSuccess(null)}>
                {actionSuccess}
              </Alert>
            ) : null}

            {exceptionStatus === 'PENDING' ? (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'background.default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    HR Decision Action
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Approving will immediately credit +{additionalHours}h to this employee's attendance.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1.5}>
                  <Button
                    variant="contained"
                    color="success"
                    size="medium"
                    startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
                    disabled={actionLoading}
                    onClick={() => handleAction('APPROVED')}
                    sx={{ fontWeight: 700, textTransform: 'none', px: 2.5 }}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="medium"
                    startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : <CancelIcon />}
                    disabled={actionLoading}
                    onClick={() => handleAction('REJECTED')}
                    sx={{ fontWeight: 700, textTransform: 'none' }}
                  >
                    Reject
                  </Button>
                </Stack>
              </Paper>
            ) : null}
          </Box>
        ) : (
          <>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-line', mb: 2.5 }}>
              {notification.body}
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Recipient Target: <strong>{notification.recipientType}</strong> ({notification.recipientId})
              </Typography>
            </Box>

            {notification.metadata && Object.keys(notification.metadata).length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Context Metadata
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    bgcolor: 'action.hover',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    maxHeight: 180,
                    overflow: 'auto',
                  }}
                >
                  <pre style={{ margin: 0 }}>
                    {JSON.stringify(notification.metadata, null, 2)}
                  </pre>
                </Paper>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        {!notification.isRead && (
          <Button
            variant="outlined"
            color="primary"
            startIcon={<CheckIcon />}
            onClick={() => {
              onMarkRead(notification);
              onClose();
            }}
          >
            Mark as Read
          </Button>
        )}
        <Button onClick={onClose} color="inherit">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
