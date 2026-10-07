import { Global, Module } from '@nestjs/common';
import { NotificationClientService } from './notification-client.service';

@Global()
@Module({
  providers: [NotificationClientService],
  exports: [NotificationClientService],
})
export class NotificationsModule {}
