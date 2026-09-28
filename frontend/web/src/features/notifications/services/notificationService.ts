import { api } from '../../../api/client';
import { NOTIFICATION_API_URL } from '../../../config/env';
import type {
  AppNotification,
  CreateNotificationPayload,
  PaginatedNotificationsResponse,
  QueryNotificationsParams,
} from '../types/notification';

interface BackendEnvelope<T> {
  success?: boolean;
  statusCode?: number;
  message?: string;
  data?: T;
}

function unwrapResponse<T>(resData: T | BackendEnvelope<T>): T {
  if (resData && typeof resData === 'object' && 'data' in resData && (resData as BackendEnvelope<T>).data !== undefined) {
    return (resData as BackendEnvelope<T>).data as T;
  }
  return resData as T;
}

/**
 * List notifications with pagination and read-status filtering.
 * GET /api/v1/notifications?recipientId=...&isRead=...&page=...&limit=...
 */
export async function fetchNotifications(
  params: QueryNotificationsParams = {},
): Promise<PaginatedNotificationsResponse> {
  const queryParams: Record<string, string | number | boolean> = {};
  if (params.recipientId) queryParams.recipientId = params.recipientId;
  if (typeof params.isRead === 'boolean') queryParams.isRead = params.isRead;
  if (params.page) queryParams.page = params.page;
  if (params.limit) queryParams.limit = params.limit;

  const response = await api.get<PaginatedNotificationsResponse | BackendEnvelope<PaginatedNotificationsResponse>>(
    `${NOTIFICATION_API_URL}`,
    { params: queryParams },
  );
  return unwrapResponse(response.data);
}

/**
 * Get count of unread notifications for a recipient.
 * GET /api/v1/notifications/unread-count?recipientId=...
 */
export async function fetchUnreadCount(recipientId: string): Promise<number> {
  const response = await api.get<{ count: number } | BackendEnvelope<{ count: number }>>(
    `${NOTIFICATION_API_URL}/unread-count`,
    { params: { recipientId } },
  );
  const data = unwrapResponse(response.data);
  return data.count ?? 0;
}

/**
 * Send an in-app or broadcast notification.
 * POST /api/v1/notifications/send
 */
export async function sendNotification(
  payload: CreateNotificationPayload,
): Promise<AppNotification> {
  const response = await api.post<AppNotification | BackendEnvelope<AppNotification>>(
    `${NOTIFICATION_API_URL}/send`,
    payload,
  );
  return unwrapResponse(response.data);
}

/**
 * Mark a notification as read.
 * PATCH /api/v1/notifications/:id/read
 */
export async function markNotificationAsRead(id: string): Promise<AppNotification> {
  const response = await api.patch<AppNotification | BackendEnvelope<AppNotification>>(
    `${NOTIFICATION_API_URL}/${id}/read`,
  );
  return unwrapResponse(response.data);
}

/**
 * Mark all notifications as read for a recipient.
 * POST /api/v1/notifications/read-all?recipientId=...
 */
export async function markAllNotificationsAsRead(recipientId: string): Promise<{ updated: number }> {
  const response = await api.post<{ updated: number } | BackendEnvelope<{ updated: number }>>(
    `${NOTIFICATION_API_URL}/read-all`,
    null,
    { params: { recipientId } },
  );
  return unwrapResponse(response.data);
}

/**
 * Delete a notification by ID.
 * DELETE /api/v1/notifications/:id
 */
export async function deleteNotification(id: string): Promise<{ success: boolean }> {
  const response = await api.delete<{ success: boolean } | BackendEnvelope<{ success: boolean }>>(
    `${NOTIFICATION_API_URL}/${id}`,
  );
  return unwrapResponse(response.data);
}

/**
 * Real-time SSE connection for notifications.
 * Connects to GET /api/v1/notifications/stream?recipientId=...
 */
export function createNotificationEventSource(
  recipientId: string,
  onNotification: (notification: AppNotification) => void,
  onError?: (error: Event) => void,
): EventSource {
  const sseUrl = `${NOTIFICATION_API_URL}/stream?recipientId=${encodeURIComponent(recipientId)}`;
  const eventSource = new EventSource(sseUrl);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data && data.notification) {
        onNotification(data.notification);
      } else if (data && data.id) {
        onNotification(data as AppNotification);
      }
    } catch (err) {
      console.warn('Could not parse SSE notification payload:', err);
    }
  };

  if (onError) {
    eventSource.onerror = onError;
  }

  return eventSource;
}
