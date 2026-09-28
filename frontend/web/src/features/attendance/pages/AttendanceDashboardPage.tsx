import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import HistoryIcon from '@mui/icons-material/History';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { api } from '../../../api/client';
import { GEOFENCE_API_URL } from '../../../config/env';
import { useAuth } from '../../../context/AuthContext';
import {
  checkInAttendance,
  checkOutAttendance,
  fetchTodayAttendance,
  getCurrentCoordinates,
  recordGeofenceExit,
  recordGeofenceReturn,
} from '../services/attendanceService';
import type { LocationCoordinates, TodayAttendanceResponse } from '../types/attendance';
import { AttendanceSummaryCards } from '../components/AttendanceSummaryCards';
import { AttendanceStatusBadge, CheckInStatusBadge } from '../components/AttendanceStatusBadge';


interface OfficeOption {
  id: string;
  name: string;
  code: string;
}

export default function AttendanceDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [todayData, setTodayData] = useState<TodayAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Live timer state
  const [liveWorkingSeconds, setLiveWorkingSeconds] = useState(0);

  // Check-in modal
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState('');
  const [locationStatus, setLocationStatus] = useState<string>('');
  const [currentCoords, setCurrentCoords] = useState<LocationCoordinates | null>(null);

  const activeSession = todayData?.sessions?.find(
    (s) => s.status === 'WORKING' || s.status === 'PAUSED',
  ) ?? null;

  const loadTodayData = useCallback(async () => {
    try {
      const res = await fetchTodayAttendance();
      setTodayData(res);
      setLiveWorkingSeconds(res.totalWorkingSecondsToday);
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Unable to load today’s attendance records.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchTodayAttendance()
      .then((res) => {
        if (active) {
          setTodayData(res);
          setLiveWorkingSeconds(res.totalWorkingSecondsToday);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const msg =
            axios.isAxiosError(err) && err.response?.data?.message
              ? String(err.response.data.message)
              : 'Unable to load today’s attendance records.';
          setError(msg);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Load available offices for check-in
  useEffect(() => {
    api
      .get<{ data?: OfficeOption[] } | OfficeOption[]>(`${GEOFENCE_API_URL}/offices`)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        setOffices(list);
        if (list.length > 0) {
          setSelectedOfficeId(list[0].id);
        }
      })
      .catch((err) => {
        console.warn('Could not load offices from geofence service:', err);
      });
  }, []);

  // Live seconds ticker when WORKING
  useEffect(() => {
    if (activeSession?.status !== 'WORKING') return;

    const interval = setInterval(() => {
      setLiveWorkingSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession?.status]);

  const handleOpenCheckInDialog = async () => {
    setCheckInDialogOpen(true);
    setLocationStatus('Detecting GPS location...');
    try {
      const coords = await getCurrentCoordinates();
      setCurrentCoords(coords);
      setLocationStatus(`Location verified: ${coords.latitude}, ${coords.longitude}`);
    } catch (locErr: unknown) {
      const msg = locErr instanceof Error ? locErr.message : 'Location detection failed';
      setLocationStatus(msg);
      // Fallback default coordinates if browser permission was blocked during local test
      setCurrentCoords({ latitude: 18.5204, longitude: 73.8567 });
    }
  };

  const handleExecuteCheckIn = async () => {
    if (!selectedOfficeId) {
      setError('Please select an office workplace.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const coords = currentCoords ?? (await getCurrentCoordinates());
      await checkInAttendance({
        officeId: selectedOfficeId,
        location: coords,
      });
      setSuccessMsg('Attendance checked in successfully!');
      setCheckInDialogOpen(false);
      await loadTodayData();
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Check-in failed. Please verify that you are within the registered office geofence.';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteCheckOut = async () => {
    if (!activeSession) return;
    setActionLoading(true);
    setError(null);
    try {
      let coords: LocationCoordinates | undefined;
      try {
        coords = await getCurrentCoordinates();
      } catch {
        // checkout allows optional location
      }
      await checkOutAttendance({
        officeId: selectedOfficeId || (offices[0]?.id ?? 'default-office'),
        location: coords,
      });
      setSuccessMsg('Attendance checked out successfully!');
      await loadTodayData();
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Check-out failed. Please try again.';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulateGeofenceExit = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const coords = currentCoords ?? { latitude: 18.5300, longitude: 73.8600 };
      await recordGeofenceExit({
        officeId: selectedOfficeId || (offices[0]?.id ?? 'default-office'),
        location: coords,
      });
      setSuccessMsg('Geofence exit recorded. Attendance session is now PAUSED.');
      await loadTodayData();
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Geofence exit update failed.';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulateGeofenceReturn = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const coords = currentCoords ?? { latitude: 18.5204, longitude: 73.8567 };
      await recordGeofenceReturn({
        officeId: selectedOfficeId || (offices[0]?.id ?? 'default-office'),
        location: coords,
      });
      setSuccessMsg('Geofence return recorded. Attendance resumed to WORKING.');
      await loadTodayData();
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Geofence return update failed.';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const isManagement = user?.appRole === 'ADMIN' || user?.appRole === 'HR';

  return (
    <DashboardLayout
      title="Attendance Management"
      subtitle="Monitor real-time employee attendance, active geofence sessions, and working hours."
    >
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Summary KPIs */}
          <AttendanceSummaryCards
            todaySession={activeSession ?? (todayData?.sessions?.[0] ?? null)}
            totalWorkingSecondsToday={todayData?.totalWorkingSecondsToday ?? 0}
            hasActiveSession={Boolean(todayData?.hasActiveSession)}
            liveWorkingSeconds={liveWorkingSeconds}
          />

          {/* Quick Action Controls */}
          <Card variant="outlined" sx={{ mb: 4, bgcolor: 'background.paper' }}>
            <CardContent sx={{ p: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 2,
                }}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Attendance Actions
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {activeSession
                      ? `Session active since ${new Date(activeSession.checkInAt).toLocaleTimeString()}`
                      : 'No active session. Check in when arriving at the assigned office.'}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
                  {!todayData?.hasActiveSession ? (
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<CheckCircleIcon />}
                      onClick={handleOpenCheckInDialog}
                      disabled={actionLoading}
                      sx={{ px: 3 }}
                    >
                      Check In Now
                    </Button>
                  ) : (
                    <>
                      {activeSession?.status === 'WORKING' ? (
                        <Button
                          variant="outlined"
                          color="warning"
                          startIcon={<PauseCircleIcon />}
                          onClick={handleSimulateGeofenceExit}
                          disabled={actionLoading}
                        >
                          Simulate Geofence Exit
                        </Button>
                      ) : activeSession?.status === 'PAUSED' ? (
                        <Button
                          variant="contained"
                          color="success"
                          startIcon={<PlayCircleFilledIcon />}
                          onClick={handleSimulateGeofenceReturn}
                          disabled={actionLoading}
                        >
                          Resume Inside Geofence
                        </Button>
                      ) : null}

                      <Button
                        variant="contained"
                        color="error"
                        startIcon={<ExitToAppIcon />}
                        onClick={handleExecuteCheckOut}
                        disabled={actionLoading}
                        sx={{ px: 3 }}
                      >
                        Check Out
                      </Button>
                    </>
                  )}

                  <Button
                    variant="outlined"
                    color="inherit"
                    startIcon={<HistoryIcon />}
                    onClick={() => navigate('/attendance/history')}
                  >
                    View History
                  </Button>

                  {isManagement && (
                    <Button
                      variant="outlined"
                      color="inherit"
                      startIcon={<AssessmentIcon />}
                      onClick={() => navigate('/attendance/reports')}
                    >
                      Reports
                    </Button>
                  )}
                </Stack>
              </Box>
            </CardContent>
          </Card>

          {/* Today's Recorded Sessions */}
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
            Today’s Session History ({todayData?.attendanceDate})
          </Typography>

          {!todayData?.sessions || todayData.sessions.length === 0 ? (
            <Card variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No attendance sessions recorded for today yet.
              </Typography>
            </Card>
          ) : (
            <Stack spacing={2}>
              {todayData.sessions.map((sess) => (
                <Card key={sess.id} variant="outlined">
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                      <Box>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                          <AttendanceStatusBadge status={sess.status} />
                          <CheckInStatusBadge status={sess.checkInStatus} />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          Check-In: <strong>{new Date(sess.checkInAt).toLocaleTimeString()}</strong>
                          {sess.checkOutAt && (
                            <> | Check-Out: <strong>{new Date(sess.checkOutAt).toLocaleTimeString()}</strong></>
                          )}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate(`/attendance/${sess.id}`)}
                      >
                        Details & Timeline
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </>
      )}

      {/* Check-In Modal */}
      <Dialog open={checkInDialogOpen} onClose={() => setCheckInDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Office Check-In</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Select your assigned office location. Your GPS coordinates will be verified against the office geofence polygon.
          </Typography>

          <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
            <InputLabel id="office-select-label">Workplace Office</InputLabel>
            <Select
              labelId="office-select-label"
              value={selectedOfficeId}
              label="Workplace Office"
              onChange={(e) => setSelectedOfficeId(e.target.value)}
            >
              {offices.map((off) => (
                <MenuItem key={off.id} value={off.id}>
                  {off.name} ({off.code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <LocationOnIcon color="primary" fontSize="small" />
            <Typography variant="caption" color="text.secondary">
              {locationStatus}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setCheckInDialogOpen(false)} color="inherit" disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleExecuteCheckIn}
            disabled={actionLoading || !selectedOfficeId}
          >
            {actionLoading ? 'Verifying Location...' : 'Confirm Check-In'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(successMsg)} autoHideDuration={4000} onClose={() => setSuccessMsg(null)}>
        <Alert severity="success" variant="filled" onClose={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
