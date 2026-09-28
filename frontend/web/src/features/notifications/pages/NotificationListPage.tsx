import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { useAuth } from '../../../context/AuthContext';
import {
  createNotificationEventSource,
  deleteNotification,
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../services/notificationService';
import type { AppNotification } from '../types/notification';
import { NotificationTable } from '../components/NotificationTable';
import { SendNotificationDialog } from '../components/SendNotificationDialog';
import { NotificationPreviewDialog } from '../components/NotificationPreviewDialog';

export default function NotificationListPage() {
  const { user } = useAuth();
  const isManagement = user?.appRole === 'ADMIN' || user?.appRole === 'HR';
  const recipientId = user?.id ?? 'ALL';

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Tabs: 0: All, 1: Unread Only
  const [tabValue, setTabValue] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Dialogs
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<AppNotification | null>(null);

  const loadNotifications = useCallback(
    async (pageToLoad = page, isReadFilter = tabValue === 1 ? false : undefined) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchNotifications({
          page: pageToLoad,
          limit,
          recipientId,
          isRead: isReadFilter,
        });
        setNotifications(res.items ?? []);
        setPage(res.page);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        setUnreadCount(res.unreadCount);
      } catch (err: unknown) {
        const msg =
          axios.isAxiosError(err) && err.response?.data?.message
            ? String(err.response.data.message)
            : 'Could not load notifications.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [page, limit, recipientId, tabValue],
  );

  useEffect(() => {
    let active = true;
    fetchNotifications({
      page: 1,
      limit,
      recipientId,
      isRead: tabValue === 1 ? false : undefined,
    })
      .then((res) => {
        if (active) {
          setNotifications(res.items ?? []);
          setPage(res.page);
          setTotal(res.total);
          setTotalPages(res.totalPages);
          setUnreadCount(res.unreadCount);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const msg =
            axios.isAxiosError(err) && err.response?.data?.message
              ? String(err.response.data.message)
              : 'Could not load notifications.';
          setError(msg);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [limit, recipientId, tabValue]);

  // Connect SSE for real-time notifications
  useEffect(() => {
    if (!recipientId) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = createNotificationEventSource(
        recipientId,
        (newNotif) => {
          setNotifications((prev) => [newNotif, ...prev]);
          setUnreadCount((c) => c + 1);
          setFeedback(`New notification: ${newNotif.title}`);
        },
        () => {
          // Silent fallback if SSE connection fails or disconnects
        },
      );
    } catch {
      // EventSource may fail in offline environment
    }

    return () => {
      eventSource?.close();
    };
  }, [recipientId]);

  const handleMarkAsRead = async (notif: AppNotification) => {
    try {
      await markNotificationAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      setError('Failed to update notification status.');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead(recipientId);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      setFeedback('All notifications marked as read.');
    } catch {
      setError('Failed to mark all as read.');
    }
  };

  const handleDelete = async (notif: AppNotification) => {
    try {
      await deleteNotification(notif.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      setTotal((t) => Math.max(0, t - 1));
      if (!notif.isRead) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      setFeedback('Notification deleted.');
    } catch {
      setError('Failed to delete notification.');
    }
  };

  return (
    <DashboardLayout
      title="Notifications & Alerts"
      subtitle="Review real-time in-app alerts, geofence updates, and organization announcements."
    >
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(_, val) => setTabValue(val)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="All Notifications" />
          <Tab
            label={
              <Badge badgeContent={unreadCount} color="error" sx={{ '& .MuiBadge-badge': { right: -12 } }}>
                Unread Only
              </Badge>
            }
          />
        </Tabs>

        <Stack direction="row" spacing={1.5}>
          {unreadCount > 0 && (
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<CheckCircleIcon />}
              onClick={handleMarkAllRead}
            >
              Mark All Read
            </Button>
          )}

          {isManagement && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<SendIcon />}
              onClick={() => setSendDialogOpen(true)}
            >
              Dispatch Notification
            </Button>
          )}
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <NotificationTable
        notifications={notifications}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={(newPage) => {
          setPage(newPage);
          void loadNotifications(newPage);
        }}
        onMarkRead={handleMarkAsRead}
        onDelete={handleDelete}
        onViewDetails={(item) => setPreviewItem(item)}
      />

      {/* Dispatch Modal */}
      <SendNotificationDialog
        open={sendDialogOpen}
        onClose={() => setSendDialogOpen(false)}
        onNotificationSent={() => {
          setFeedback('Notification dispatched successfully!');
          void loadNotifications(1);
        }}
      />

      {/* Details Preview Modal */}
      <NotificationPreviewDialog
        open={Boolean(previewItem)}
        notification={previewItem}
        onClose={() => setPreviewItem(null)}
        onMarkRead={handleMarkAsRead}
      />

      <Snackbar open={Boolean(feedback)} autoHideDuration={4000} onClose={() => setFeedback(null)}>
        <Alert severity="success" variant="filled" onClose={() => setFeedback(null)}>
          {feedback}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
