export const NOTIFICATION_TYPES = [
  'GEOFENCE_EXIT_WARNING',
  'GEOFENCE_RETURN',
  'CHECKIN_CONFIRMATION',
  'CHECKOUT_CONFIRMATION',
  'EXCEPTION_REQUESTED',
  'EXCEPTION_APPROVED',
  'EXCEPTION_REJECTED',
  'SYSTEM_ALERT',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationRecipientType = 'EMPLOYEE' | 'USER' | 'BROADCAST';

export interface AppNotification {
  id: string;
  recipientId: string;
  recipientType: NotificationRecipientType;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;

  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface PaginatedNotificationsResponse {
  items: AppNotification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface QueryNotificationsParams {
  recipientId?: string;
  isRead?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateNotificationPayload {
  recipientId: string;
  recipientType?: NotificationRecipientType;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;

}
