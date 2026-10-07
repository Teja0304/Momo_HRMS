import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import TimerIcon from '@mui/icons-material/Timer';
import type { AttendanceSession } from '../types/attendance';
import { AttendanceStatusBadge, CheckInStatusBadge } from './AttendanceStatusBadge';

interface Props {
  todaySession: AttendanceSession | null;
  totalWorkingSecondsToday: number;
  totalRegularWorkingSecondsToday?: number;
  totalSpecialConditionSecondsToday?: number;
  hasActiveSession: boolean;
  liveWorkingSeconds?: number;
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function AttendanceSummaryCards({
  todaySession,
  totalWorkingSecondsToday,
  totalSpecialConditionSecondsToday,
  hasActiveSession,
  liveWorkingSeconds,
}: Props) {
  const displayWorkingSeconds = liveWorkingSeconds ?? totalWorkingSecondsToday;
  const currentStatus = todaySession?.status ?? (hasActiveSession ? 'WORKING' : 'COMPLETED');

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
        gap: 2.5,
        mb: 3,
      }}
    >
      <Card variant="outlined">
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              Working Time Today
            </Typography>
            <TimerIcon color="primary" fontSize="small" />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: 'monospace' }}>
            {formatDuration(displayWorkingSeconds)}
          </Typography>
          {totalSpecialConditionSecondsToday && totalSpecialConditionSecondsToday > 0 ? (
            <Typography variant="caption" sx={{ color: 'secondary.main', fontWeight: 700, display: 'block' }}>
              +{formatDuration(totalSpecialConditionSecondsToday)} Special (HR Approved)
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">
              {todaySession ? 'Active session counter' : 'No active timer'}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              Current State
            </Typography>
            <CheckCircleIcon color="primary" fontSize="small" />
          </Box>
          <Box sx={{ mt: 0.5, mb: 0.5 }}>
            {todaySession ? (
              <AttendanceStatusBadge status={currentStatus} />
            ) : (
              <Typography variant="body1" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                Not Checked In
              </Typography>
            )}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {todaySession?.currentGraceDeadline ? 'Grace period running' : 'Real-time geofence tracking'}
          </Typography>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              Check-In Details
            </Typography>
            <AccessTimeIcon color="primary" fontSize="small" />
          </Box>
          {todaySession ? (
            <>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {new Date(todaySession.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <CheckInStatusBadge status={todaySession.checkInStatus} />
              </Box>
            </>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                No check-in recorded yet
              </Typography>
            </>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              Geofence Pauses
            </Typography>
            <PauseCircleIcon color="warning" fontSize="small" />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            {todaySession?.pauses?.length ?? 0}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Total paused: {todaySession ? formatDuration(todaySession.totalPausedSeconds) : '00:00:00'}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
