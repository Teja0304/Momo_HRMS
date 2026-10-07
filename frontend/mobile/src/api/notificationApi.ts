import { notificationClient } from './client';

export type NotificationType =
  | 'CHECK_IN_SUCCESS'
  | 'CHECK_OUT_SUCCESS'
  | 'AUTO_CHECKOUT'
  | 'REMINDER'
  | 'LATE_CHECKIN'
  | 'OUTSIDE_OFFICE'
  | 'ATTENDANCE_ISSUE'
  | 'LEAVE'
  | 'PROFILE_UPDATE'
  | 'SYSTEM'
  | string;

export interface AppNotification {
  id: string;
  recipientId: string;
  recipientType?: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface NotificationListResponse {
  items: AppNotification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount: number;
}

export interface GetNotificationsParams {
  recipientId?: string;
  isRead?: boolean;
  page?: number;
  limit?: number;
}

export async function getNotifications(params: GetNotificationsParams = {}): Promise<NotificationListResponse> {
  const { data } = await notificationClient.get<NotificationListResponse>('/notifications', {
    params,
  });
  return data;
}

export async function getUnreadNotificationCount(recipientId: string): Promise<number> {
  if (!recipientId) return 0;
  try {
    const { data } = await notificationClient.get<{ count?: number; unreadCount?: number }>('/notifications/unread-count', {
      params: { recipientId },
    });
    return data?.count ?? data?.unreadCount ?? 0;
  } catch {
    return 0;
  }
}

export async function markNotificationAsRead(id: string): Promise<AppNotification> {
  const { data } = await notificationClient.patch<AppNotification>(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsAsRead(recipientId: string): Promise<{ count: number }> {
  const { data } = await notificationClient.post<{ count: number }>('/notifications/read-all', null, {
    params: { recipientId },
  });
  return data;
}
