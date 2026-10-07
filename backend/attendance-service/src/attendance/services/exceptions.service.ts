import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCodes } from '../../common/constants/error-codes';
import { CreateExceptionDto, ExceptionType } from '../dto/create-exception.dto';
import { ApproveExceptionDto, ApproveStatus } from '../dto/approve-exception.dto';
import { ExceptionStatus } from '@prisma/client';
import { NotificationClientService } from '../../notifications/notification-client.service';

@Injectable()
export class ExceptionsService {
  private readonly logger = new Logger(ExceptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationClient: NotificationClientService,
  ) {}

  async createException(dto: CreateExceptionDto) {
    const attendanceDate = new Date(dto.attendanceDate);
    let validFrom: Date;
    let validUntil: Date;

    if (dto.validFrom && dto.validUntil) {
      validFrom = new Date(dto.validFrom);
      validUntil = new Date(dto.validUntil);
      if (validUntil <= validFrom) {
        throw new AppException(
          ErrorCodes.VALIDATION_FAILED,
          'validUntil must be after validFrom',
          HttpStatus.BAD_REQUEST,
        );
      }
    } else {
      // Default: valid for entire attendance day
      validFrom = new Date(dto.attendanceDate);
      validFrom.setHours(0, 0, 0, 0);
      validUntil = new Date(dto.attendanceDate);
      validUntil.setHours(23, 59, 59, 999);
    }

    // Rule 16: Check for duplicate pending requests for the same date & employee
    const existingPending = await this.prisma.attendanceException.findFirst({
      where: {
        employeeId: dto.employeeId,
        attendanceDate,
        type: dto.type as unknown as ExceptionType,
        status: ExceptionStatus.PENDING,
      },
    });

    if (existingPending) {
      throw new AppException(
        ErrorCodes.VALIDATION_FAILED,
        'A pending special working-hours request already exists for this date. Please wait for HR to review it.',
        HttpStatus.CONFLICT,
      );
    }

    const additionalHours =
      Number(dto.additionalHours) ||
      (Number(dto.additionalMinutes) ? Number(dto.additionalMinutes) / 60 : 0);
    const additionalMinutes =
      Number(dto.additionalMinutes) || Math.round(additionalHours * 60);
    const additionalSeconds = additionalMinutes * 60;

    const metadata: Record<string, any> = {
      ...(dto.metadata || {}),
      additionalHours,
      additionalMinutes,
      additionalSeconds,
      hrEmail: (dto.hrEmail || dto.metadata?.hrEmail || 'hr@company.com').trim().toLowerCase(),
      employeeName: dto.metadata?.employeeName || 'Employee',
      employeeEmail: dto.metadata?.employeeEmail || '',
      dateStr: dto.attendanceDate,
    };

    const exception = await this.prisma.attendanceException.create({
      data: {
        employeeId: dto.employeeId,
        attendanceDate,
        type: dto.type as unknown as ExceptionType,
        reason: dto.reason?.trim() || 'Special working hours requested',
        attendanceSessionId: dto.attendanceSessionId,
        validFrom,
        validUntil,
        status: ExceptionStatus.PENDING,
        metadata,
      },
    });

    this.logger.log(`Created attendance exception ${exception.id} for employee ${dto.employeeId}`);

    // Notify HR via notification-service (broadcast to HR or specific HR recipient)
    const targetHrEmail = metadata.hrEmail;
    const empName = metadata.employeeName || dto.employeeId;
    void this.notificationClient.sendNotification({
      recipientId: targetHrEmail || 'HR',
      recipientType: 'HR',
      type: 'SPECIAL_WORKING_HOURS_REQUEST',
      title: 'Special Working Hours Request',
      body: `Employee ${empName} requested +${additionalHours} hours for ${dto.attendanceDate}.\nMessage: ${dto.reason?.trim()}`,
      metadata: {
        exceptionId: exception.id,
        employeeId: dto.employeeId,
        employeeName: empName,
        employeeEmail: metadata.employeeEmail,
        hrEmail: targetHrEmail,
        attendanceDate: dto.attendanceDate,
        requestedHours: additionalHours,
        additionalMinutes,
        additionalSeconds,
        reason: dto.reason?.trim(),
        createdAt: exception.createdAt.toISOString(),
      },
    });

    return exception;
  }

  async approveException(id: string, approverUserId: string, dto: ApproveExceptionDto) {
    const exception = await this.prisma.attendanceException.findUnique({
      where: { id },
    });

    if (!exception) {
      throw new AppException(
        ErrorCodes.NOT_FOUND,
        'Attendance exception not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (exception.status !== ExceptionStatus.PENDING) {
      throw new AppException(
        ErrorCodes.INVALID_STATE_TRANSITION,
        `Exception is already ${exception.status}. Cannot re-approve or modify.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const isApproved = dto.status === ApproveStatus.APPROVED;
    const meta = (exception.metadata as Record<string, any>) || {};
    const additionalHours =
      meta.additionalHours ||
      (meta.additionalMinutes ? meta.additionalMinutes / 60 : 0);
    const dateFormatted = exception.attendanceDate.toISOString().split('T')[0];

    const updatedMetadata = {
      ...meta,
      approvedByUserId: approverUserId,
      approvedAt: new Date().toISOString(),
      comment: dto.comment,
    };

    const updated = await this.prisma.attendanceException.update({
      where: { id },
      data: {
        status: isApproved ? ExceptionStatus.APPROVED : ExceptionStatus.REJECTED,
        approvedByUserId: approverUserId,
        approvedAt: new Date(),
        metadata: updatedMetadata,
      },
    });

    this.logger.log(`Exception ${id} was ${dto.status} by user ${approverUserId}`);

    // Notify employee of exception decision
    if (isApproved) {
      void this.notificationClient.sendNotification({
        recipientId: exception.employeeId,
        type: 'SPECIAL_CONDITION_APPROVED',
        title: 'Special Condition Approved',
        body: `HR approved your request for +${additionalHours} hours on ${dateFormatted}.`,
        metadata: {
          exceptionId: exception.id,
          type: exception.type,
          status: updated.status,
          additionalHours,
          attendanceDate: dateFormatted,
        },
      });
    } else {
      void this.notificationClient.sendNotification({
        recipientId: exception.employeeId,
        type: 'SPECIAL_CONDITION_REJECTED',
        title: 'Special Condition Request Rejected',
        body: `Your request for additional working hours on ${dateFormatted} was rejected by HR.`,
        metadata: {
          exceptionId: exception.id,
          type: exception.type,
          status: updated.status,
          attendanceDate: dateFormatted,
        },
      });
    }

    return updated;
  }

  async getExceptions(employeeId?: string, status?: ExceptionStatus, hrEmail?: string) {
    const list = await this.prisma.attendanceException.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (hrEmail) {
      const hrLower = hrEmail.trim().toLowerCase();
      return list.filter((ex) => {
        const meta = (ex.metadata as Record<string, any>) || {};
        return !meta.hrEmail || meta.hrEmail.toLowerCase() === hrLower;
      });
    }

    return list;
  }

  async cancelException(id: string) {
    const exception = await this.prisma.attendanceException.findUnique({
      where: { id },
    });
    if (!exception) {
      throw new AppException(ErrorCodes.NOT_FOUND, 'Exception not found', HttpStatus.NOT_FOUND);
    }
    if (exception.status !== ExceptionStatus.PENDING) {
      throw new AppException(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Cannot cancel an exception that has already been approved or rejected.',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.prisma.attendanceException.delete({
      where: { id },
    });
    return { success: true, message: 'Attendance exception cancelled' };
  }
}
