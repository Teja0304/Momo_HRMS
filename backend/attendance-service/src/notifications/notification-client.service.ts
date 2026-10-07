import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendNotificationPayload {
  recipientId: string;
  recipientType?: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationClientService {
  private readonly logger = new Logger(NotificationClientService.name);
  private readonly notificationServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.notificationServiceUrl = this.configService.get<string>(
      'NOTIFICATION_SERVICE_URL',
      'http://localhost:3005/api/v1',
    );
  }

  async sendNotification(payload: SendNotificationPayload): Promise<void> {
    try {
      const response = await fetch(`${this.notificationServiceUrl}/notifications/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientId: payload.recipientId,
          recipientType: payload.recipientType || 'EMPLOYEE',
          type: payload.type,
          title: payload.title,
          body: payload.body,
          metadata: payload.metadata || {},
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `Notification service responded with status ${response.status} when notifying ${payload.recipientId}`,
        );
      }
    } catch (error) {
      // Fire-and-forget: Attendance operations must never fail if notifications encounter a temporary issue
      this.logger.warn(
        `Failed to send notification to ${payload.recipientId}: ${(error as Error).message}`,
      );
    }
  }
}
