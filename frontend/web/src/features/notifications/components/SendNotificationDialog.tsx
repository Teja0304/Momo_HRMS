import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SendIcon from '@mui/icons-material/Send';
import { NOTIFICATION_TYPES, type NotificationType } from '../types/notification';
import { sendNotification } from '../services/notificationService';

interface Props {
  open: boolean;
  onClose: () => void;
  onNotificationSent: () => void;
}

export function SendNotificationDialog({ open, onClose, onNotificationSent }: Props) {
  const [targetMode, setTargetMode] = useState<'BROADCAST' | 'EMPLOYEE'>('BROADCAST');
  const [recipientId, setRecipientId] = useState('ALL');
  const [type, setType] = useState<NotificationType>('SYSTEM_ALERT');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [metadataStr, setMetadataStr] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTargetModeChange = (mode: 'BROADCAST' | 'EMPLOYEE') => {
    setTargetMode(mode);
    setRecipientId(mode === 'BROADCAST' ? 'ALL' : '');
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !recipientId.trim()) {
      setError('Please provide title, message body, and a valid recipient.');
      return;
    }

    let parsedMeta: Record<string, unknown> | undefined;
    if (metadataStr.trim()) {
      try {
        parsedMeta = JSON.parse(metadataStr);
      } catch {
        setError('Metadata must be a valid JSON string (or left empty).');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      await sendNotification({
        recipientId: recipientId.trim(),
        recipientType: targetMode === 'BROADCAST' ? 'BROADCAST' : 'EMPLOYEE',
        type,
        title: title.trim(),
        body: body.trim(),
        metadata: parsedMeta,
      });

      setTitle('');
      setBody('');
      setMetadataStr('');
      onNotificationSent();
      onClose();
    } catch {
      setError('Failed to dispatch notification. Please check network connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSend}>
        <DialogTitle sx={{ fontWeight: 800 }}>Dispatch Notification / Alert</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Send an in-app notice, geofence warning, or organizational announcement.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1}>
              <Button
                variant={targetMode === 'BROADCAST' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => handleTargetModeChange('BROADCAST')}
              >
                Broadcast to All
              </Button>
              <Button
                variant={targetMode === 'EMPLOYEE' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => handleTargetModeChange('EMPLOYEE')}
              >
                Specific Employee
              </Button>
            </Stack>

            {targetMode === 'EMPLOYEE' && (
              <TextField
                label="Recipient Employee ID"
                size="small"
                placeholder="e.g. EMP-001 or User UUID"
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                required
                fullWidth
              />
            )}

            <FormControl fullWidth size="small">
              <InputLabel id="notif-type-label">Notification Type</InputLabel>
              <Select
                labelId="notif-type-label"
                value={type}
                label="Notification Type"
                onChange={(e) => setType(e.target.value as NotificationType)}
              >
                {NOTIFICATION_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Notification Title"
              size="small"
              placeholder="e.g. Scheduled Office Maintenance"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              fullWidth
            />

            <TextField
              label="Notification Body / Message"
              size="small"
              placeholder="Enter message text..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              multiline
              rows={3}
              required
              fullWidth
            />

            <TextField
              label="Custom Metadata (JSON, Optional)"
              size="small"
              placeholder='e.g. { "officeId": "...", "severity": "HIGH" }'
              value={metadataStr}
              onChange={(e) => setMetadataStr(e.target.value)}
              multiline
              rows={2}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={onClose} color="inherit" disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" startIcon={<SendIcon />} disabled={submitting}>
            {submitting ? 'Sending...' : 'Send Notification'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
