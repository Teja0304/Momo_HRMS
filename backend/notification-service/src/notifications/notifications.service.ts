import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { SseService } from './sse.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sseService: SseService,
  ) {}

  async create(dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        recipientId: dto.recipientId,
        recipientType: dto.recipientType || 'EMPLOYEE',
        type: dto.type,
        title: dto.title,
        body: dto.body,
        metadata: dto.metadata || {},
      },
    });

    // Stream in real-time to active in-app connections
    this.sseService.emitNotification({
      recipientId: notification.recipientId,
      recipientType: notification.recipientType,
      notification,
    });

    this.logger.log(`Created notification ${notification.id} for ${notification.recipientId} (${notification.type})`);
    return notification;
  }

  async findAll(query: QueryNotificationsDto) {
    const { recipientId, isRead, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (recipientId) {
      where.OR = [
        { recipientId },
        { recipientId: 'ALL' },
        { recipientType: 'BROADCAST' },
      ];
    }
    if (typeof isRead === 'boolean') {
      where.isRead = isRead;
    }

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: {
          ...(recipientId
            ? {
                OR: [
                  { recipientId },
                  { recipientId: 'ALL' },
                  { recipientType: 'BROADCAST' },
                ],
              }
            : {}),
          isRead: false,
        },
      }),
    ]);

    return {
      items,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnreadCount(recipientId: string) {
    const count = await this.prisma.notification.count({
      where: {
        OR: [
          { recipientId },
          { recipientId: 'ALL' },
          { recipientType: 'BROADCAST' },
        ],
        isRead: false,
      },
    });
    return { count };
  }

  async markAsRead(id: string) {
    const existing = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(recipientId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        OR: [{ recipientId }, { recipientId: 'ALL' }],
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updated: result.count };
  }

  async remove(id: string) {
    const existing = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    await this.prisma.notification.delete({
      where: { id },
    });

    return { success: true };
  }
}
