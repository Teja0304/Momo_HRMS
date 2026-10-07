import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SseService } from './sse.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, SseService],
  exports: [NotificationsService, SseService],
})
export class NotificationsModule {}
