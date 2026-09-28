import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { fetchAttendanceHistory } from '../services/attendanceService';
import type { AttendanceSession } from '../types/attendance';
import { AttendanceFilters } from '../components/AttendanceFilters';

function getDefaultDateRange() {
  const end = new Date().toISOString().split('T')[0];
  const start = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return { start, end };
}

export default function AttendanceReportsPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);

  const [startDate, setStartDate] = useState(() => getDefaultDateRange().start);
  const [endDate, setEndDate] = useState(() => getDefaultDateRange().end);

  useEffect(() => {
    let active = true;
    fetchAttendanceHistory({
      startDate,
      endDate,
      page: 1,
      limit: 100,
    })
      .then((res) => {
        if (active) {
          setSessions(res.items ?? []);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const msg =
            axios.isAxiosError(err) && err.response?.data?.message
              ? String(err.response.data.message)
              : 'Failed to load report analytics.';
          setError(msg);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [startDate, endDate]);

  // Aggregate Calculations
  const totalSessions = sessions.length;
  const onTimeCount = sessions.filter((s) => s.checkInStatus === 'ON_TIME').length;
  const gracePeriodCount = sessions.filter((s) => s.checkInStatus === 'GRACE_PERIOD').length;
  const lateCount = sessions.filter((s) => s.checkInStatus === 'LATE').length;

  const onTimeRate = totalSessions > 0 ? Math.round((onTimeCount / totalSessions) * 100) : 0;
  const totalSeconds = sessions.reduce((acc, s) => acc + s.totalWorkingSeconds, 0);
  const totalHours = (totalSeconds / 3600).toFixed(1);
  const avgHours = totalSessions > 0 ? (totalSeconds / totalSessions / 3600).toFixed(1) : '0';

  const handleExportCsv = () => {
    if (sessions.length === 0) return;
    const headers = ['Date', 'Status', 'Punctuality', 'CheckIn', 'CheckOut', 'WorkingHours', 'PausedHours'];
    const rows = sessions.map((s) => [
      s.attendanceDate,
      s.status,
      s.checkInStatus,
      s.checkInAt,
      s.checkOutAt ?? '',
      (s.totalWorkingSeconds / 3600).toFixed(2),
      (s.totalPausedSeconds / 3600).toFixed(2),
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `attendance_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DashboardLayout
      title="Attendance Analytics & Reports"
      subtitle="Comprehensive metrics on organizational attendance, punctuality trends, and working hours."
    >
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Button
          variant="text"
          color="inherit"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/attendance')}
        >
          Back to Attendance Dashboard
        </Button>

        <Button
          variant="outlined"
          color="primary"
          startIcon={<FileDownloadIcon />}
          onClick={handleExportCsv}
          disabled={sessions.length === 0}
        >
          Export CSV Report
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <AttendanceFilters
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onReset={() => {
          const range = getDefaultDateRange();
          setStartDate(range.start);
          setEndDate(range.end);
        }}
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={3}>
          {/* High level KPI cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
              gap: 2.5,
            }}
          >
            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Total Sessions
                  </Typography>
                  <TrendingUpIcon color="primary" fontSize="small" />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                  {totalSessions}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Across selected date range
                </Typography>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    On-Time Rate
                  </Typography>
                  <CheckCircleIcon color="success" fontSize="small" />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 800, color: onTimeRate >= 80 ? 'success.main' : 'warning.main' }}>
                  {onTimeRate}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {onTimeCount} of {totalSessions} sessions
                </Typography>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Total Working Hours
                  </Typography>
                  <AccessTimeIcon color="primary" fontSize="small" />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: 'monospace' }}>
                  {totalHours}h
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Cumulative hours worked
                </Typography>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Avg Daily Hours
                  </Typography>
                  <AccessTimeIcon color="info" fontSize="small" />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: 'monospace' }}>
                  {avgHours}h
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Average per session
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {/* Punctuality Breakdown */}
          <Card variant="outlined">
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                Punctuality Distribution
              </Typography>

              <Stack spacing={2.5}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      On Time
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {onTimeCount} ({totalSessions > 0 ? Math.round((onTimeCount / totalSessions) * 100) : 0}%)
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={totalSessions > 0 ? (onTimeCount / totalSessions) * 100 : 0}
                    color="success"
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>

                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Grace Period
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {gracePeriodCount} ({totalSessions > 0 ? Math.round((gracePeriodCount / totalSessions) * 100) : 0}%)
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={totalSessions > 0 ? (gracePeriodCount / totalSessions) * 100 : 0}
                    color="warning"
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>

                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Late
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {lateCount} ({totalSessions > 0 ? Math.round((lateCount / totalSessions) * 100) : 0}%)
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={totalSessions > 0 ? (lateCount / totalSessions) * 100 : 0}
                    color="error"
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      )}
    </DashboardLayout>
  );
}
