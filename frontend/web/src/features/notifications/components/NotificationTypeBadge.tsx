import Chip from '@mui/material/Chip';
import type { NotificationType } from '../types/notification';

interface Props {
  type: NotificationType;
}

export function NotificationTypeBadge({ type }: Props) {
  switch (type) {
    case 'CHECKIN_CONFIRMATION':
      return <Chip label="Check-In" color="success" size="small" variant="filled" sx={{ fontWeight: 600 }} />;
    case 'CHECKOUT_CONFIRMATION':
      return <Chip label="Check-Out" color="default" size="small" variant="outlined" sx={{ fontWeight: 600 }} />;
    case 'GEOFENCE_EXIT_WARNING':
      return <Chip label="Geofence Exit" color="warning" size="small" variant="filled" sx={{ fontWeight: 600 }} />;
    case 'GEOFENCE_RETURN':
      return <Chip label="Geofence Return" color="info" size="small" variant="filled" sx={{ fontWeight: 600 }} />;
    case 'EXCEPTION_REQUESTED':
      return <Chip label="Exception Request" color="warning" size="small" variant="outlined" sx={{ fontWeight: 600 }} />;
    case 'EXCEPTION_APPROVED':
      return <Chip label="Exception Approved" color="success" size="small" variant="outlined" sx={{ fontWeight: 600 }} />;
    case 'EXCEPTION_REJECTED':
      return <Chip label="Exception Rejected" color="error" size="small" variant="outlined" sx={{ fontWeight: 600 }} />;
    case 'SYSTEM_ALERT':
    default:
      return <Chip label={type.replace(/_/g, ' ')} color="primary" size="small" variant="outlined" sx={{ fontWeight: 600 }} />;
  }
}
