import Chip from '@mui/material/Chip';
import type { AttendanceStatus, CheckInStatus } from '../types/attendance';

interface AttendanceStatusBadgeProps {
  status: AttendanceStatus;
}

export function AttendanceStatusBadge({ status }: AttendanceStatusBadgeProps) {
  switch (status) {
    case 'WORKING':
      return <Chip label="Working" color="success" size="small" variant="filled" sx={{ fontWeight: 600 }} />;
    case 'PAUSED':
      return <Chip label="Paused (Outside Geofence)" color="warning" size="small" variant="filled" sx={{ fontWeight: 600 }} />;
    case 'COMPLETED':
    case 'CHECKED_OUT':
      return <Chip label="Checked Out" color="default" size="small" variant="outlined" sx={{ fontWeight: 600 }} />;
    case 'AUTO_CHECKED_OUT':
      return <Chip label="Auto Checked Out" color="warning" size="small" variant="outlined" sx={{ fontWeight: 600 }} />;
    default:
      return <Chip label={status} size="small" />;
  }
}

interface CheckInStatusBadgeProps {
  status: CheckInStatus;
}

export function CheckInStatusBadge({ status }: CheckInStatusBadgeProps) {
  switch (status) {
    case 'ON_TIME':
      return <Chip label="On Time" color="success" size="small" variant="outlined" sx={{ fontWeight: 600 }} />;
    case 'GRACE_PERIOD':
      return <Chip label="Grace Period" color="warning" size="small" variant="outlined" sx={{ fontWeight: 600 }} />;
    case 'LATE':
      return <Chip label="Late" color="error" size="small" variant="outlined" sx={{ fontWeight: 600 }} />;
    default:
      return <Chip label={status} size="small" />;
  }
}
