import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface SseNotificationEvent {
  recipientId: string;
  recipientType: string;
  notification: any;
}

@Injectable()
export class SseService {
  private readonly logger = new Logger(SseService.name);
  private readonly eventStream$ = new Subject<SseNotificationEvent>();

  /**
   * Emit an event to connected clients.
   */
  emitNotification(event: SseNotificationEvent): void {
    this.logger.debug(`Broadcasting SSE notification to ${event.recipientId}`);
    this.eventStream$.next(event);
  }

  /**
   * Subscribe to live notifications for a specific recipient (or broadcast).
   */
  getRecipientStream(recipientId: string): Observable<MessageEvent> {
    return this.eventStream$.asObservable().pipe(
      filter(
        (event) =>
          event.recipientId === 'ALL' ||
          event.recipientId === recipientId ||
          event.recipientType === 'BROADCAST',
      ),
      map(
        (event) =>
          ({
            data: event.notification,
            type: 'notification',
          } as MessageEvent),
      ),
    );
  }
}
