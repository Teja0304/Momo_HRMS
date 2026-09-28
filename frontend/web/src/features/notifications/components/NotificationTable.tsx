import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Pagination from '@mui/material/Pagination';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import CheckIcon from '@mui/icons-material/Check';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import type { AppNotification } from '../types/notification';
import { NotificationTypeBadge } from './NotificationTypeBadge';

interface Props {
  notifications: AppNotification[];
  loading: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (newPage: number) => void;
  onMarkRead: (notification: AppNotification) => void;
  onDelete: (notification: AppNotification) => void;
  onViewDetails: (notification: AppNotification) => void;
}

export function NotificationTable({
  notifications,
  loading,
  page,
  totalPages,
  total,
  onPageChange,
  onMarkRead,
  onDelete,
  onViewDetails,
}: Props) {
  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <CircularProgress size={36} />
        <Typography color="text.secondary">Loading notifications...</Typography>
      </Paper>
    );
  }

  if (notifications.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          No Notifications
        </Typography>
        <Typography color="text.secondary" variant="body2">
          Your inbox is completely caught up. No messages or alerts at this time.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <TableContainer>
        <Table sx={{ minWidth: 650 }}>
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, width: 40 }}></TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Notification</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Recipient</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {notifications.map((item) => (
              <TableRow
                key={item.id}
                hover
                sx={{
                  bgcolor: item.isRead ? 'inherit' : 'rgba(27, 75, 143, 0.04)',
                }}
              >
                <TableCell>
                  {!item.isRead && (
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                      }}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <NotificationTypeBadge type={item.type} />
                </TableCell>
                <TableCell>
                  <Typography variant="subtitle2" sx={{ fontWeight: item.isRead ? 600 : 800 }}>
                    {item.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {item.body}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {item.recipientType === 'BROADCAST' ? 'ALL EMPLOYEES' : item.recipientId}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(item.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                    {!item.isRead && (
                      <IconButton
                        size="small"
                        color="primary"
                        title="Mark as Read"
                        onClick={() => onMarkRead(item)}
                      >
                        <CheckIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      color="inherit"
                      title="View Details"
                      onClick={() => onViewDetails(item)}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      title="Delete Notification"
                      onClick={() => onDelete(item)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Showing <strong>{notifications.length}</strong> of <strong>{total}</strong> notifications
        </Typography>
        {totalPages > 1 && (
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, val) => onPageChange(val)}
            color="primary"
            shape="rounded"
          />
        )}
      </Box>
    </Paper>
  );
}
