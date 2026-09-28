import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EventNoteIcon from '@mui/icons-material/EventNote';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { fetchAttendanceById } from '../services/attendanceService';
import type { AttendanceSession } from '../types/attendance';
import { AttendanceStatusBadge, CheckInStatusBadge } from '../components/AttendanceStatusBadge';

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function formatIso(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return '—';
  }
}

export default function AttendanceDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchAttendanceById(id)
      .then((data) => {
        if (active) {
          setSession(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const msg =
            axios.isAxiosError(err) && err.response?.data?.message
              ? String(err.response.data.message)
              : 'Could not load session details.';
          setError(msg);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  return (
    <DashboardLayout
      title="Attendance Session Breakdown"
      subtitle="Comprehensive timeline and breakdown of check-in, check-out, and geofence pauses."
    >
      <Box sx={{ mb: 3 }}>
        <Button
          variant="text"
          color="inherit"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/attendance/history')}
        >
          Back to History
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
          <CircularProgress />
        </Box>
      ) : !session ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">Session not found.</Typography>
        </Card>
      ) : (
        <Stack spacing={3}>
          {/* Key Session Attributes */}
          <Card variant="outlined">
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    Date: {session.attendanceDate}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Session ID: {session.id}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <AttendanceStatusBadge status={session.status} />
                  <CheckInStatusBadge status={session.checkInStatus} />
                </Stack>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
                  gap: 2.5,
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Check-In Time
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {formatIso(session.checkInAt)}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Check-Out Time
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {formatIso(session.checkOutAt)}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Total Working Duration
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                    {formatDuration(session.totalWorkingSeconds)}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Total Paused Duration
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                    {formatDuration(session.totalPausedSeconds)}
                  </Typography>
                </Box>
              </Box>

              {(session.checkoutType || session.checkoutReason) && (
                <Box sx={{ mt: 2.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
                  <Typography variant="body2">
                    Checkout Mode: <strong>{session.checkoutType ?? 'NORMAL'}</strong>
                    {session.checkoutReason && <> — Reason: <em>{session.checkoutReason}</em></>}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Pauses Log */}
          <Card variant="outlined">
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <PauseCircleIcon color="warning" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Geofence Pauses ({session.pauses?.length ?? 0})
                </Typography>
              </Box>

              {!session.pauses || session.pauses.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No geofence pauses occurred during this session.
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Pause Started</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Pause Ended</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Grace Deadline</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>End Reason</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {session.pauses.map((pause, idx) => (
                        <TableRow key={pause.id || idx}>
                          <TableCell>{formatIso(pause.startedAt)}</TableCell>
                          <TableCell>{formatIso(pause.endedAt)}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace' }}>
                            {formatDuration(pause.durationSeconds)}
                          </TableCell>
                          <TableCell>{formatIso(pause.graceDeadline)}</TableCell>
                          <TableCell>{pause.endReason ?? 'Active / Ongoing'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          {/* Events Log */}
          {session.events && session.events.length > 0 && (
            <Card variant="outlined">
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <EventNoteIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Event Log ({session.events.length})
                  </Typography>
                </Box>

                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Event</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Coordinates</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Source</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {session.events.map((evt) => (
                        <TableRow key={evt.id}>
                          <TableCell sx={{ fontWeight: 600 }}>{evt.eventType}</TableCell>
                          <TableCell>{formatIso(evt.eventTime)}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace' }}>
                            {evt.latitude && evt.longitude ? `${evt.latitude}, ${evt.longitude}` : '—'}
                          </TableCell>
                          <TableCell>{evt.source}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </Stack>
      )}
    </DashboardLayout>
  );
}
