import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { SseService } from './sse.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sseService: SseService,
    private readonly emailService: EmailService,
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

    // Dispatch email notifications via EmailService (SMTP)
    try {
      if (dto.type === 'SPECIAL_WORKING_HOURS_REQUEST') {
        const meta = (dto.metadata || {}) as Record<string, any>;
        const targetHrEmail = meta.hrEmail || (dto.recipientId.includes('@') ? dto.recipientId : 'priya.patil@company.com');
        void this.emailService.sendSpecialWorkingHoursEmail({
          hrEmail: targetHrEmail,
          employeeName: meta.employeeName || 'Employee',
          employeeId: meta.employeeId || dto.recipientId,
          employeeEmail: meta.employeeEmail,
          attendanceDate: meta.attendanceDate || new Date().toISOString().split('T')[0],
          additionalHours: Number(meta.requestedHours || meta.additionalHours || 1),
          reason: meta.reason || dto.body,
          exceptionId: meta.exceptionId || notification.id,
        });
      } else if (dto.type === 'SPECIAL_CONDITION_APPROVED' || dto.type === 'SPECIAL_CONDITION_REJECTED') {
        const meta = (dto.metadata || {}) as Record<string, any>;
        if (meta.employeeEmail) {
          void this.emailService.sendDecisionEmail({
            employeeEmail: meta.employeeEmail,
            employeeName: meta.employeeName || 'Employee',
            status: dto.type === 'SPECIAL_CONDITION_APPROVED' ? 'APPROVED' : 'REJECTED',
            attendanceDate: meta.attendanceDate || '',
            additionalHours: meta.additionalHours,
            comment: meta.comment,
          });
        }
      }
    } catch (emailErr: any) {
      this.logger.warn(`Email delivery dispatch error: ${emailErr.message}`);
    }

    this.logger.log(`Created notification ${notification.id} for ${notification.recipientId} (${notification.type})`);
    return notification;
  }

  private buildRecipientWhere(recipientId?: string, email?: string, role?: string): any {
    const isManagement =
      (role && ['HR', 'ADMIN', 'HR_ADMIN', 'SUPER_ADMIN'].includes(role.toUpperCase())) ||
      recipientId === 'HR' ||
      (email && (email.toLowerCase().includes('hr') || email.toLowerCase().includes('admin')));

    const orConditions: any[] = [
      { recipientId: 'ALL' },
      { recipientType: 'BROADCAST' },
    ];

    if (recipientId && recipientId !== 'ALL') {
      orConditions.push({ recipientId });
    }

    if (email) {
      orConditions.push({ recipientId: email });
    }

    // HR and management staff can view all notifications addressed to HR and special hours requests
    if (isManagement) {
      orConditions.push({ recipientType: 'HR' });
      orConditions.push({ recipientId: 'HR' });
      orConditions.push({ type: 'SPECIAL_WORKING_HOURS_REQUEST' });
    }

    return { OR: orConditions };
  }

  async findAll(query: QueryNotificationsDto) {
    const { recipientId, email, role, isRead, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const baseWhere = this.buildRecipientWhere(recipientId, email, role);
    const where: any = { ...baseWhere };
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
          ...baseWhere,
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

  async getUnreadCount(recipientId?: string, email?: string, role?: string) {
    const where = {
      ...this.buildRecipientWhere(recipientId, email, role),
      isRead: false,
    };
    const count = await this.prisma.notification.count({ where });
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

  async markAllAsRead(recipientId?: string, email?: string, role?: string) {
    const baseWhere = this.buildRecipientWhere(recipientId, email, role);
    const result = await this.prisma.notification.updateMany({
      where: {
        ...baseWhere,
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
