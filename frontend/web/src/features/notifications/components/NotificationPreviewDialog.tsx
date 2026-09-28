import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckIcon from '@mui/icons-material/Check';
import type { AppNotification } from '../types/notification';
import { NotificationTypeBadge } from './NotificationTypeBadge';

interface Props {
  open: boolean;
  notification: AppNotification | null;
  onClose: () => void;
  onMarkRead: (notification: AppNotification) => void;
}

export function NotificationPreviewDialog({
  open,
  notification,
  onClose,
  onMarkRead,
}: Props) {
  if (!notification) return null;

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
