import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Sse,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { SseService } from './sse.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

@ApiTags('Notifications')
@Controller('notifications')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly sseService: SseService,
  ) {}

  @Post('send')
  @ApiOperation({ summary: 'Send an in-app notification (Internal / Service-to-Service)' })
  @ApiResponse({ status: 201, description: 'Notification created and broadcasted via SSE' })
  async send(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List notifications for a user/employee with pagination' })
  async findAll(@Query() query: QueryNotificationsDto) {
    return this.notificationsService.findAll(query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count for a recipient' })
  @ApiQuery({ name: 'recipientId', required: true, type: String })
  async getUnreadCount(@Query('recipientId') recipientId: string) {
    return this.notificationsService.getUnreadCount(recipientId);
  }

  @Sse('stream')
  @ApiOperation({ summary: 'Real-time Server-Sent Events (SSE) notification stream for web and mobile' })
  @ApiQuery({ name: 'recipientId', required: true, type: String })
  stream(@Query('recipientId') recipientId: string): Observable<MessageEvent> {
    return this.sseService.getRecipientStream(recipientId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for a recipient' })
  @ApiQuery({ name: 'recipientId', required: true, type: String })
  async markAllAsRead(@Query('recipientId') recipientId: string) {
    return this.notificationsService.markAllAsRead(recipientId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  async remove(@Param('id') id: string) {
    return this.notificationsService.remove(id);
  }
}
