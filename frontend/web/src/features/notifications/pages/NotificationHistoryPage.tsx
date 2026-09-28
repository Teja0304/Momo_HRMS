import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { DashboardLayout } from '../../../components/DashboardLayout';
import {
  deleteNotification,
  fetchNotifications,
  markNotificationAsRead,
} from '../services/notificationService';
import type { AppNotification } from '../types/notification';
import { NotificationTable } from '../components/NotificationTable';
import { NotificationPreviewDialog } from '../components/NotificationPreviewDialog';

export default function NotificationHistoryPage() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [previewItem, setPreviewItem] = useState<AppNotification | null>(null);

  const loadAllHistory = useCallback(
    async (pageToLoad = page) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchNotifications({
          page: pageToLoad,
          limit,
        });
        setNotifications(res.items ?? []);
        setPage(res.page);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      } catch (err: unknown) {
        const msg =
          axios.isAxiosError(err) && err.response?.data?.message
            ? String(err.response.data.message)
            : 'Could not load broadcast history.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [page, limit],
  );

  useEffect(() => {
    let active = true;
    fetchNotifications({ page: 1, limit })
      .then((res) => {
        if (active) {
          setNotifications(res.items ?? []);
          setPage(res.page);
          setTotal(res.total);
          setTotalPages(res.totalPages);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const msg =
            axios.isAxiosError(err) && err.response?.data?.message
              ? String(err.response.data.message)
              : 'Could not load broadcast history.';
          setError(msg);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [limit]);

  const handleMarkAsRead = async (notif: AppNotification) => {
    try {
      await markNotificationAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)),
      );
    } catch {
      setError('Failed to update notification status.');
    }
  };

  const handleDelete = async (notif: AppNotification) => {
    try {
      await deleteNotification(notif.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      setTotal((t) => Math.max(0, t - 1));
    } catch {
      setError('Failed to delete notification.');
    }
  };

  return (
    <DashboardLayout
      title="Notification Broadcast History"
      subtitle="Complete audit log of system alerts, geofence warnings, and announcements."
    >
      <Box sx={{ mb: 3 }}>
        <Button
          variant="text"
          color="inherit"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/notifications')}
        >
          Back to Inbox
        </Button>
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
          void loadAllHistory(newPage);
        }}
        onMarkRead={handleMarkAsRead}
        onDelete={handleDelete}
        onViewDetails={(item) => setPreviewItem(item)}
      />

      <NotificationPreviewDialog
        open={Boolean(previewItem)}
        notification={previewItem}
        onClose={() => setPreviewItem(null)}
        onMarkRead={handleMarkAsRead}
      />
    </DashboardLayout>
  );
}
