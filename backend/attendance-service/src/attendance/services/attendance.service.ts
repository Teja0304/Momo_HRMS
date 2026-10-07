import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma, ExceptionType, ExceptionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCodes } from '../../common/constants/error-codes';
import {
  EMPLOYEE_PROVIDER,
  EmployeeProvider,
} from '../../employee/interfaces/employee-provider.interface';
import {
  GEOFENCE_PROVIDER,
  GeofenceProvider,
} from '../../geofence/interfaces/geofence-provider.interface';
import {
  ATTENDANCE_POLICY_PROVIDER,
  AttendancePolicy,
  AttendancePolicyProvider,
} from '../../policy/interfaces/attendance-policy-provider.interface';
import {
  FACE_AI_PROVIDER,
  FaceAiProvider,
} from '../../face/interfaces/face-ai-provider.interface';
import { WorkingTimeService } from './working-time.service';
import { NotificationClientService } from '../../notifications/notification-client.service';
import { CheckInDto } from '../dto/check-in.dto';
import { CheckOutDto } from '../dto/check-out.dto';
import { GeofenceExitDto } from '../dto/geofence-exit.dto';
import { GeofenceReturnDto } from '../dto/geofence-return.dto';
import { SyncDto } from '../dto/sync.dto';
import { HistoryQueryDto } from '../dto/history-query.dto';
import { LocationDto } from '../dto/location.dto';
import {
  AttendanceSessionResponseDto,
  PaginatedHistoryResponseDto,
  SyncResponseDto,
  TodayAttendanceResponseDto,
} from '../dto/attendance-session-response.dto';
import {
  AttendanceEventSource,
  AttendanceEventType,
  AttendanceStatus,
  CheckInStatus,
  CheckoutReason,
  CheckoutType,
  PauseEndReason,
  SyncResultStatus,
} from '../enums';

/** Result of every mutating flow: the current session + whether this
 * call was a no-op replay of an already-processed clientEventId. */
interface ActionResult {
  session: AttendanceSessionResponseDto;
  idempotentReplay: boolean;
}

type SessionWithPauses = Prisma.AttendanceSessionGetPayload<{ include: { pauses: true } }>;

/** Error codes that represent "the state machine says no", mapped to
 * SyncResultStatus.INVALID_STATE rather than a generic REJECTED. */
const INVALID_STATE_CODES = new Set<string>([
  ErrorCodes.ATTENDANCE_ALREADY_ACTIVE,
  ErrorCodes.ATTENDANCE_ALREADY_COMPLETED,
  ErrorCodes.NO_ACTIVE_SESSION,
  ErrorCodes.INVALID_STATE_TRANSITION,
  ErrorCodes.CHECKOUT_WHILE_PAUSED_NOT_ALLOWED,
]);

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workingTimeService: WorkingTimeService,
    @Inject(GEOFENCE_PROVIDER) private readonly geofenceProvider: GeofenceProvider,
    @Inject(EMPLOYEE_PROVIDER) private readonly employeeProvider: EmployeeProvider,
    @Inject(ATTENDANCE_POLICY_PROVIDER) private readonly policyProvider: AttendancePolicyProvider,
    @Inject(FACE_AI_PROVIDER) private readonly faceAiProvider: FaceAiProvider,
    private readonly notificationClient: NotificationClientService,
  ) {}

  private async resolveEmployeeIds(employeeId: string): Promise<string[]> {
    if (!employeeId) return [];
    try {
      if (typeof this.employeeProvider.resolveEmployeeIdentifiers === 'function') {
        const resolved = await this.employeeProvider.resolveEmployeeIdentifiers(employeeId);
        if (resolved && resolved.length > 0) return resolved;
      }
    } catch (e) {
      this.logger.debug(`Could not resolve alternate identifiers for ${employeeId}: ${(e as Error).message}`);
    }
    return [employeeId];
  }

  // ---------------------------------------------------------------------
  // CHECK-IN
  // ---------------------------------------------------------------------
  async checkIn(
    employeeId: string,
    dto: CheckInDto,
    effectiveTime: Date = new Date(),
    source: AttendanceEventSource = AttendanceEventSource.ONLINE,
  ): Promise<ActionResult> {
    const replay = await this.findIdempotentReplay(dto.clientEventId, AttendanceEventType.CHECK_IN);
    if (replay) return replay;

    const policy = await this.policyProvider.getPolicy(dto.officeId);
    this.validateLocationAccuracy(dto.location, policy);

    const assigned = await this.employeeProvider.isAssignedToOffice(employeeId, dto.officeId);
    if (!assigned) {
      throw new AppException(
        ErrorCodes.EMPLOYEE_NOT_ASSIGNED_TO_OFFICE,
        'Employee is not assigned to this office',
        HttpStatus.FORBIDDEN,
      );
    }

    const inside = await this.geofenceProvider.isInsideOffice(
      dto.officeId,
      dto.location.latitude,
      dto.location.longitude,
    );
    if (!inside) {
      throw new AppException(
        ErrorCodes.OUTSIDE_GEOFENCE,
        'Employee location is outside the office boundary',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // Mandatory Face Biometric Verification
    const faceResult = await this.faceAiProvider.validateVerificationToken(
      employeeId,
      dto.faceVerificationToken,
    );
    if (!faceResult.valid) {
      this.logger.warn(`Check-in rejected for employee ${employeeId}: face verification failed (${faceResult.message})`);
      throw new AppException(
        ErrorCodes.FACE_VERIFICATION_FAILED,
        `Face biometric verification failed: ${faceResult.message}`,
        HttpStatus.FORBIDDEN,
      );
    }

    const attendanceDate = this.toDateOnly(effectiveTime);
    const checkInStatus = this.determineCheckInStatus(effectiveTime, policy);

    const session = await this.prisma.$transaction(async (tx) => {
      // Serialize concurrent check-in attempts for this exact employee via
      // a row lock, so two simultaneous requests can't both observe "no
      // active session" and both create one. See schema.prisma's
      // EmployeeAttendanceLock model for why this exists instead of a
      // UNIQUE(employeeId, attendanceDate) constraint (multiple sessions
      // per day are allowed; only one ACTIVE session is not).
      await tx.employeeAttendanceLock.upsert({
        where: { employeeId },
        update: {},
        create: { employeeId },
      });
      await tx.$queryRawUnsafe(
        'SELECT employee_id FROM employee_attendance_locks WHERE employee_id = ? FOR UPDATE',
        employeeId,
      );

      // Re-check idempotency now that we hold the lock — closes the race
      // where two requests with the SAME clientEventId arrived together.
      const existingEvent = await tx.attendanceEvent.findUnique({
        where: { clientEventId: dto.clientEventId },
      });
      if (existingEvent) {
        // Handled by returning null and letting the caller re-run the
        // (cheap, non-transactional) idempotency lookup after the lock
        // is released — see below.
        return null;
      }

      const ids = await this.resolveEmployeeIds(employeeId);
      const activeSession = await tx.attendanceSession.findFirst({
        where: { employeeId: { in: ids }, status: { in: [AttendanceStatus.WORKING, AttendanceStatus.PAUSED] } },
        include: { pauses: true },
      });
      if (activeSession) {
        const sessionDateOnly = this.toDateOnly(activeSession.attendanceDate);
        if (sessionDateOnly.getTime() < attendanceDate.getTime()) {
          // Stale active session from a previous calendar day: auto-checkout so today's shift can start
          this.logger.warn(
            `Employee ${employeeId} has a stale unclosed session ${activeSession.id} from ${this.formatDateOnly(sessionDateOnly)}. Auto-closing it so today's check-in can proceed.`,
          );
          const autoCheckoutTime = new Date(activeSession.checkInAt.getTime() + 8 * 3600 * 1000);
          const totalWorkingSeconds = this.workingTimeService.calculateWorkingSeconds(
            {
              status: AttendanceStatus.CHECKED_OUT,
              checkInAt: activeSession.checkInAt,
              checkOutAt: autoCheckoutTime,
              currentPauseStartedAt: null,
            },
            activeSession.pauses,
            autoCheckoutTime,
          );
          await tx.attendanceSession.update({
            where: { id: activeSession.id },
            data: {
              status: AttendanceStatus.CHECKED_OUT,
              checkOutAt: autoCheckoutTime,
              checkoutType: CheckoutType.AUTO,
              checkoutReason: CheckoutReason.SYSTEM_ACTION,
              totalWorkingSeconds,
              currentPauseStartedAt: null,
              currentGraceDeadline: null,
            },
          });
        } else {
          throw new AppException(
            ErrorCodes.ATTENDANCE_ALREADY_ACTIVE,
            'Employee already has an active attendance session',
          );
        }
      }

      const completedToday = await tx.attendanceSession.findFirst({
        where: {
          employeeId,
          attendanceDate,
          status: AttendanceStatus.CHECKED_OUT,
        },
      });

      let reopenReason: string | undefined = undefined;
      let reopenAuthorizedBy: string | undefined = undefined;

      if (completedToday) {
        const approvedException = await tx.attendanceException?.findFirst?.({
          where: {
            employeeId,
            attendanceDate,
            type: 'RECHECK_IN',
            status: 'APPROVED',
            validFrom: { lte: effectiveTime },
            validUntil: { gte: effectiveTime },
          },
          orderBy: { approvedAt: 'desc' },
        });

        if (approvedException) {
          reopenReason = approvedException.reason;
          reopenAuthorizedBy = approvedException.approvedByUserId ?? undefined;

          await tx.attendanceException.update({
            where: { id: approvedException.id },
            data: { status: 'USED' },
          });
        } else {
          // Re-check-in / multiple check-ins on the same calendar day are allowed (e.g. split shifts, returning from lunch)
          reopenReason = 'RECHECK_IN';
        }
      }

      const created = await tx.attendanceSession.create({
        data: {
          employeeId,
          officeId: dto.officeId,
          attendanceDate,
          status: AttendanceStatus.WORKING,
          checkInAt: effectiveTime,
          checkInStatus,
          reopenReason,
          reopenAuthorizedBy,
        },
      });

      await tx.attendanceEvent.create({
        data: {
          attendanceSessionId: created.id,
          employeeId,
          clientEventId: dto.clientEventId,
          eventType: AttendanceEventType.CHECK_IN,
          eventTime: effectiveTime,
          latitude: dto.location.latitude,
          longitude: dto.location.longitude,
          altitudeMeters: dto.location.altitudeMeters,
          accuracyMeters: dto.location.accuracyMeters,
          source,
        },
      });

      return { ...created, pauses: [] as SessionWithPauses['pauses'] };
    });

    if (!session) {
      // Another concurrent request with the same clientEventId won the
      // lock first — return its result as our idempotent replay.
      const replayAfterRace = await this.findIdempotentReplay(
        dto.clientEventId,
        AttendanceEventType.CHECK_IN,
      );
      if (replayAfterRace) return replayAfterRace;
      // Extremely unlikely: event vanished between checks. Treat as a
      // fresh attempt failure rather than silently succeeding.
      throw new AppException(
        ErrorCodes.CONFLICT,
        'Concurrent check-in could not be resolved, please retry',
      );
    }

    this.logger.log(`CHECK_IN employeeId=${employeeId} sessionId=${session.id}`);

    void this.notificationClient.sendNotification({
      recipientId: employeeId,
      type: 'CHECKIN_CONFIRMATION',
      title: 'Check-in Verified',
      body: `You checked in at ${effectiveTime.toLocaleTimeString()} at office ${dto.officeId}.`,
      metadata: { sessionId: session.id, officeId: dto.officeId },
    });

    return { session: this.toSessionDto(session, session.pauses, effectiveTime), idempotentReplay: false };
  }

  // ---------------------------------------------------------------------
  // CHECK-OUT
  // ---------------------------------------------------------------------
  async checkOut(
    employeeId: string,
    dto: CheckOutDto,
    effectiveTime: Date = new Date(),
    source: AttendanceEventSource = AttendanceEventSource.ONLINE,
  ): Promise<ActionResult> {
    const replay = await this.findIdempotentReplay(dto.clientEventId, AttendanceEventType.CHECK_OUT);
    if (replay) return replay;

    const policy = await this.policyProvider.getPolicy(dto.officeId ?? '');

    const ids = await this.resolveEmployeeIds(employeeId);
    const active = await this.prisma.attendanceSession.findFirst({
      where: { employeeId: { in: ids }, status: { in: [AttendanceStatus.WORKING, AttendanceStatus.PAUSED] } },
      include: { pauses: true },
      orderBy: { checkInAt: 'desc' },
    });

    if (!active) {
      throw new AppException(ErrorCodes.NO_ACTIVE_SESSION, 'No active attendance session to check out');
    }

    if (active.status === AttendanceStatus.PAUSED && !policy.allowManualCheckoutWhilePaused) {
      throw new AppException(
        ErrorCodes.CHECKOUT_WHILE_PAUSED_NOT_ALLOWED,
        'Cannot manually check out while paused; return to the office first',
      );
    }

    const totalWorkingSeconds = this.workingTimeService.calculateWorkingSeconds(
      { status: AttendanceStatus.CHECKED_OUT, checkInAt: active.checkInAt, checkOutAt: effectiveTime, currentPauseStartedAt: null },
      active.pauses,
      effectiveTime,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.attendanceSession.updateMany({
        where: { id: active.id, status: active.status },
        data: {
          status: AttendanceStatus.CHECKED_OUT,
          checkOutAt: effectiveTime,
          checkoutType: CheckoutType.MANUAL,
          checkoutReason: CheckoutReason.USER_CHECKOUT,
          totalWorkingSeconds,
          currentPauseStartedAt: null,
          currentGraceDeadline: null,
        },
      });

      if (count === 0) {
        throw new AppException(
          ErrorCodes.CONFLICT,
          'Attendance session was modified concurrently (e.g. already auto-checked-out); please retry',
        );
      }

      // If checkout-while-paused was allowed, close the still-open pause too.
      if (active.status === AttendanceStatus.PAUSED) {
        const openPause = active.pauses.find((p) => p.endedAt === null);
        if (openPause) {
          await tx.attendancePause.updateMany({
            where: { id: openPause.id, endedAt: null },
            data: {
              endedAt: effectiveTime,
              durationSeconds: Math.round(
                (effectiveTime.getTime() - openPause.startedAt.getTime()) / 1000,
              ),
              endReason: PauseEndReason.RETURNED,
            },
          });
        }
      }

      await tx.attendanceEvent.create({
        data: {
          attendanceSessionId: active.id,
          employeeId,
          clientEventId: dto.clientEventId,
          eventType: AttendanceEventType.CHECK_OUT,
          eventTime: effectiveTime,
          latitude: dto.location?.latitude,
          longitude: dto.location?.longitude,
          altitudeMeters: dto.location?.altitudeMeters,
          accuracyMeters: dto.location?.accuracyMeters,
          source,
        },
      });

      return tx.attendanceSession.findUniqueOrThrow({
        where: { id: active.id },
        include: { pauses: true },
      });
    });

    this.logger.log(`CHECK_OUT employeeId=${employeeId} sessionId=${updated.id}`);

    const sessionDto = this.toSessionDto(updated, updated.pauses, effectiveTime);

    void this.notificationClient.sendNotification({
      recipientId: employeeId,
      type: 'CHECKOUT_CONFIRMATION',
      title: 'Check-out Recorded',
      body: `You checked out at ${effectiveTime.toLocaleTimeString()}. Worked: ${Math.round((sessionDto.totalWorkingSeconds || 0) / 60)} minutes.`,
      metadata: { sessionId: updated.id, totalWorkingSeconds: sessionDto.totalWorkingSeconds },
    });

    return { session: sessionDto, idempotentReplay: false };
  }

  // ---------------------------------------------------------------------
  // GEOFENCE EXIT
  // ---------------------------------------------------------------------
  async geofenceExit(
    employeeId: string,
    dto: GeofenceExitDto,
    effectiveTime: Date = new Date(),
    source: AttendanceEventSource = AttendanceEventSource.ONLINE,
  ): Promise<ActionResult> {
    const replay = await this.findIdempotentReplay(
      dto.clientEventId,
      AttendanceEventType.GEOFENCE_EXIT,
    );
    if (replay) return replay;

    const ids = await this.resolveEmployeeIds(employeeId);
    const working = await this.prisma.attendanceSession.findFirst({
      where: { employeeId: { in: ids }, status: AttendanceStatus.WORKING },
      include: { pauses: true },
    });
    if (!working) {
      throw new AppException(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Employee must have an active WORKING session to record a geofence exit',
      );
    }

    const stillInside = await this.geofenceProvider.isInsideOffice(
      dto.officeId,
      dto.location.latitude,
      dto.location.longitude,
    );
    if (stillInside) {
      throw new AppException(
        ErrorCodes.STILL_INSIDE_GEOFENCE,
        'Location still reports inside the office boundary; exit not confirmed',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const policy = await this.policyProvider.getPolicy(dto.officeId);
    const graceDeadline = new Date(effectiveTime.getTime() + policy.gracePeriodMinutes * 60_000);

    const updated = await this.prisma.$transaction(async (tx) => {
      const existingOpenPause = await tx.attendancePause.findFirst({
        where: { attendanceSessionId: working.id, endedAt: null },
      });
      if (existingOpenPause) {
        // Defensive: the WORKING precondition above should already
        // guarantee this can't happen, but never allow two open pauses.
        throw new AppException(
          ErrorCodes.CONFLICT,
          'Session already has an open pause',
        );
      }

      const { count } = await tx.attendanceSession.updateMany({
        where: { id: working.id, status: AttendanceStatus.WORKING },
        data: {
          status: AttendanceStatus.PAUSED,
          currentPauseStartedAt: effectiveTime,
          currentGraceDeadline: graceDeadline,
        },
      });
      if (count === 0) {
        throw new AppException(ErrorCodes.CONFLICT, 'Session state changed concurrently; please retry');
      }

      await tx.attendancePause.create({
        data: {
          attendanceSessionId: working.id,
          startedAt: effectiveTime,
          graceDeadline,
        },
      });

      await tx.attendanceEvent.create({
        data: {
          attendanceSessionId: working.id,
          employeeId,
          clientEventId: dto.clientEventId,
          eventType: AttendanceEventType.GEOFENCE_EXIT,
          eventTime: effectiveTime,
          latitude: dto.location.latitude,
          longitude: dto.location.longitude,
          altitudeMeters: dto.location.altitudeMeters,
          accuracyMeters: dto.location.accuracyMeters,
          source,
        },
      });

      return tx.attendanceSession.findUniqueOrThrow({
        where: { id: working.id },
        include: { pauses: true },
      });
    });

    this.logger.log(`GEOFENCE_EXIT employeeId=${employeeId} sessionId=${updated.id}`);

    void this.notificationClient.sendNotification({
      recipientId: employeeId,
      type: 'GEOFENCE_EXIT_WARNING',
      title: 'Geofence Exit Detected',
      body: `You stepped outside the office polygon. Session paused. Return before ${graceDeadline.toLocaleTimeString()} to resume.`,
      metadata: { sessionId: updated.id, officeId: dto.officeId, graceDeadline },
    });

    return { session: this.toSessionDto(updated, updated.pauses, effectiveTime), idempotentReplay: false };
  }

  // ---------------------------------------------------------------------
  // GEOFENCE RETURN
  // ---------------------------------------------------------------------
  async geofenceReturn(
    employeeId: string,
    dto: GeofenceReturnDto,
    effectiveTime: Date = new Date(),
    source: AttendanceEventSource = AttendanceEventSource.ONLINE,
  ): Promise<ActionResult> {
    const replay = await this.findIdempotentReplay(
      dto.clientEventId,
      AttendanceEventType.GEOFENCE_RETURN,
    );
    if (replay) return replay;

    const ids = await this.resolveEmployeeIds(employeeId);
    const paused = await this.prisma.attendanceSession.findFirst({
      where: { employeeId: { in: ids }, status: AttendanceStatus.PAUSED },
      include: { pauses: true },
    });
    if (!paused) {
      throw new AppException(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Employee must have a PAUSED session to record a geofence return',
      );
    }

    const inside = await this.geofenceProvider.isInsideOffice(
      dto.officeId,
      dto.location.latitude,
      dto.location.longitude,
    );
    if (!inside) {
      throw new AppException(
        ErrorCodes.OUTSIDE_GEOFENCE,
        'Location does not confirm the employee is back inside the office boundary',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const openPause = paused.pauses.find((p) => p.endedAt === null);
    if (!openPause) {
      throw new AppException(ErrorCodes.CONFLICT, 'No active pause found for this session');
    }

    const durationSeconds = Math.max(
      0,
      Math.round((effectiveTime.getTime() - openPause.startedAt.getTime()) / 1000),
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const pauseUpdate = await tx.attendancePause.updateMany({
        where: { id: openPause.id, endedAt: null },
        data: { endedAt: effectiveTime, durationSeconds, endReason: PauseEndReason.RETURNED },
      });
      if (pauseUpdate.count === 0) {
        throw new AppException(ErrorCodes.CONFLICT, 'Pause was already closed concurrently; please retry');
      }

      const sessionUpdate = await tx.attendanceSession.updateMany({
        where: { id: paused.id, status: AttendanceStatus.PAUSED },
        data: {
          status: AttendanceStatus.WORKING,
          currentPauseStartedAt: null,
          currentGraceDeadline: null,
        },
      });
      if (sessionUpdate.count === 0) {
        throw new AppException(
          ErrorCodes.CONFLICT,
          'Session state changed concurrently (e.g. auto-checkout already ran); please retry',
        );
      }

      await tx.attendanceEvent.create({
        data: {
          attendanceSessionId: paused.id,
          employeeId,
          clientEventId: dto.clientEventId,
          eventType: AttendanceEventType.GEOFENCE_RETURN,
          eventTime: effectiveTime,
          latitude: dto.location.latitude,
          longitude: dto.location.longitude,
          altitudeMeters: dto.location.altitudeMeters,
          accuracyMeters: dto.location.accuracyMeters,
          source,
        },
      });

      return tx.attendanceSession.findUniqueOrThrow({
        where: { id: paused.id },
        include: { pauses: true },
      });
    });

    this.logger.log(`GEOFENCE_RETURN employeeId=${employeeId} sessionId=${updated.id}`);

    void this.notificationClient.sendNotification({
      recipientId: employeeId,
      type: 'GEOFENCE_RETURN',
      title: 'Returned to Office',
      body: 'Welcome back to the office polygon. Your session is active again.',
      metadata: { sessionId: updated.id },
    });

    return { session: this.toSessionDto(updated, updated.pauses, effectiveTime), idempotentReplay: false };
  }

  // ---------------------------------------------------------------------
  // OFFLINE SYNC
  // ---------------------------------------------------------------------
  async sync(employeeId: string, dto: SyncDto): Promise<SyncResponseDto> {
    const results: SyncResponseDto['results'] = [];

    // Processed sequentially (not Promise.all) to preserve per-employee
    // event ordering — offline batches are inherently order-sensitive
    // (e.g. GEOFENCE_EXIT must be applied before GEOFENCE_RETURN).
    for (const event of dto.events) {
      try {
        const effectiveTime = new Date(event.eventTime);
        const source = AttendanceEventSource.OFFLINE_SYNC;
        let result: ActionResult;

        switch (event.eventType) {
          case AttendanceEventType.CHECK_IN:
            result = await this.checkIn(
              employeeId,
              {
                officeId: event.officeId,
                location: this.requireLocation(event),
                clientEventId: event.clientEventId,
                faceVerificationToken: event.faceVerificationToken ?? '',
              },
              effectiveTime,
              source,
            );
            break;
          case AttendanceEventType.CHECK_OUT:
            result = await this.checkOut(
              employeeId,
              { officeId: event.officeId, location: event.location, clientEventId: event.clientEventId },
              effectiveTime,
              source,
            );
            break;
          case AttendanceEventType.GEOFENCE_EXIT:
            result = await this.geofenceExit(
              employeeId,
              { officeId: event.officeId, location: this.requireLocation(event), clientEventId: event.clientEventId },
              effectiveTime,
              source,
            );
            break;
          case AttendanceEventType.GEOFENCE_RETURN:
            result = await this.geofenceReturn(
              employeeId,
              { officeId: event.officeId, location: this.requireLocation(event), clientEventId: event.clientEventId },
              effectiveTime,
              source,
            );
            break;
          default:
            results.push({
              clientEventId: event.clientEventId,
              status: SyncResultStatus.REJECTED,
              message: `Unsupported eventType for sync: ${event.eventType}`,
            });
            continue;
        }

        results.push({
          clientEventId: event.clientEventId,
          status: result.idempotentReplay ? SyncResultStatus.ALREADY_PROCESSED : SyncResultStatus.PROCESSED,
        });
      } catch (error) {
        results.push(this.toSyncResult(event.clientEventId, error));
      }
    }

    return { results };
  }

  // ---------------------------------------------------------------------
  // QUERIES
  // ---------------------------------------------------------------------
  async getToday(employeeId: string, now: Date = new Date()): Promise<TodayAttendanceResponseDto> {
    const ids = await this.resolveEmployeeIds(employeeId);
    const attendanceDate = this.toDateOnly(now);
    const attendanceDateStr = this.formatDateOnly(attendanceDate);

    const sessions = await this.prisma.attendanceSession.findMany({
      where: { employeeId: { in: ids }, attendanceDate },
      include: { pauses: true },
      orderBy: { checkInAt: 'asc' },
    });

    const approvedExceptions = await this.prisma.attendanceException.findMany({
      where: {
        employeeId: { in: ids },
        attendanceDate,
        type: ExceptionType.WORKING_TIME_ADJUSTMENT,
        status: ExceptionStatus.APPROVED,
      },
    });

    let totalAdjustmentSeconds = 0;
    const reasons: string[] = [];
    for (const ex of approvedExceptions) {
      const { seconds, reason } = this.extractAdjustmentFromException(ex);
      totalAdjustmentSeconds += seconds;
      if (reason && !reasons.includes(reason)) reasons.push(reason);
    }
    const combinedReason = reasons.join('; ');

    let sessionDtos: AttendanceSessionResponseDto[] = [];
    if (sessions.length > 0) {
      sessionDtos = sessions.map((s, idx) => {
        const adj = idx === 0 ? totalAdjustmentSeconds : 0;
        const r = idx === 0 ? combinedReason : undefined;
        return this.toSessionDto(s, s.pauses, now, adj, r);
      });
    } else if (totalAdjustmentSeconds > 0 && approvedExceptions.length > 0) {
      sessionDtos = [
        this.createSynthesizedSpecialSession(
          ids[0] || employeeId,
          attendanceDateStr,
          approvedExceptions[0],
          totalAdjustmentSeconds,
          combinedReason,
        ),
      ];
    }

    const totalWorkingSecondsToday = sessionDtos.reduce((sum, s) => sum + s.totalWorkingSeconds, 0);
    const totalRegularWorkingSecondsToday = sessionDtos.reduce(
      (sum, s) => sum + (s.regularWorkingSeconds ?? 0),
      0,
    );
    const totalSpecialConditionSecondsToday = totalAdjustmentSeconds;

    const hasActiveSession = sessions.some(
      (s) => s.status === AttendanceStatus.WORKING || s.status === AttendanceStatus.PAUSED,
    );

    return {
      attendanceDate: attendanceDateStr,
      sessions: sessionDtos,
      totalWorkingSecondsToday,
      totalRegularWorkingSecondsToday,
      totalSpecialConditionSecondsToday,
      hasActiveSession,
    };
  }

  async getAllToday(now: Date = new Date()): Promise<TodayAttendanceResponseDto> {
    const attendanceDate = this.toDateOnly(now);
    const attendanceDateStr = this.formatDateOnly(attendanceDate);

    const sessions = await this.prisma.attendanceSession.findMany({
      where: { attendanceDate },
      include: { pauses: true },
      orderBy: { checkInAt: 'asc' },
    });

    const approvedExceptions = await this.prisma.attendanceException.findMany({
      where: {
        attendanceDate,
        type: ExceptionType.WORKING_TIME_ADJUSTMENT,
        status: ExceptionStatus.APPROVED,
      },
    });

    const adjustmentsByEmployee = new Map<string, { seconds: number; reasons: string[]; exception: any }>();
    for (const ex of approvedExceptions) {
      const { seconds, reason } = this.extractAdjustmentFromException(ex);
      const prev = adjustmentsByEmployee.get(ex.employeeId) || { seconds: 0, reasons: [], exception: ex };
      prev.seconds += seconds;
      if (reason && !prev.reasons.includes(reason)) prev.reasons.push(reason);
      adjustmentsByEmployee.set(ex.employeeId, prev);
    }

    const employeeAdjustmentsApplied = new Set<string>();
    const sessionDtos: AttendanceSessionResponseDto[] = sessions.map((s) => {
      let adj = 0;
      let reason: string | undefined;
      if (!employeeAdjustmentsApplied.has(s.employeeId)) {
        const empAdj = adjustmentsByEmployee.get(s.employeeId);
        if (empAdj) {
          adj = empAdj.seconds;
          reason = empAdj.reasons.join('; ');
          employeeAdjustmentsApplied.add(s.employeeId);
        }
      }
      return this.toSessionDto(s, s.pauses, now, adj, reason);
    });

    for (const [empId, empAdj] of adjustmentsByEmployee.entries()) {
      if (!employeeAdjustmentsApplied.has(empId) && empAdj.seconds > 0) {
        sessionDtos.push(
          this.createSynthesizedSpecialSession(
            empId,
            attendanceDateStr,
            empAdj.exception,
            empAdj.seconds,
            empAdj.reasons.join('; '),
          ),
        );
      }
    }

    const totalWorkingSecondsToday = sessionDtos.reduce((sum, s) => sum + s.totalWorkingSeconds, 0);
    const totalRegularWorkingSecondsToday = sessionDtos.reduce(
      (sum, s) => sum + (s.regularWorkingSeconds ?? 0),
      0,
    );
    const totalSpecialConditionSecondsToday = Array.from(adjustmentsByEmployee.values()).reduce(
      (sum, a) => sum + a.seconds,
      0,
    );

    const hasActiveSession = sessions.some(
      (s) => s.status === AttendanceStatus.WORKING || s.status === AttendanceStatus.PAUSED,
    );

    return {
      attendanceDate: attendanceDateStr,
      sessions: sessionDtos,
      totalWorkingSecondsToday,
      totalRegularWorkingSecondsToday,
      totalSpecialConditionSecondsToday,
      hasActiveSession,
    };
  }

  async getAllHistory(query: HistoryQueryDto): Promise<PaginatedHistoryResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 1000;

    const endDate = query.endDate ? this.toDateOnly(new Date(query.endDate)) : this.toDateOnly(new Date());
    const startDate = query.startDate
      ? this.toDateOnly(new Date(query.startDate))
      : this.toDateOnly(new Date(endDate.getTime() - 29 * 24 * 60 * 60 * 1000));

    const where: Prisma.AttendanceSessionWhereInput = {
      attendanceDate: { gte: startDate, lte: endDate },
    };

    const items = await this.prisma.attendanceSession.findMany({
      where,
      include: { pauses: true },
      orderBy: [{ attendanceDate: 'desc' }, { checkInAt: 'desc' }],
    });

    const approvedExceptions = await this.prisma.attendanceException.findMany({
      where: {
        attendanceDate: { gte: startDate, lte: endDate },
        type: ExceptionType.WORKING_TIME_ADJUSTMENT,
        status: ExceptionStatus.APPROVED,
      },
    });

    const adjustmentsByKey = new Map<string, { seconds: number; reasons: string[]; exception: any }>();
    for (const ex of approvedExceptions) {
      const dStr = this.formatDateOnly(ex.attendanceDate);
      const key = `${ex.employeeId}_${dStr}`;
      const { seconds, reason } = this.extractAdjustmentFromException(ex);
      const prev = adjustmentsByKey.get(key) || { seconds: 0, reasons: [], exception: ex };
      prev.seconds += seconds;
      if (reason && !prev.reasons.includes(reason)) prev.reasons.push(reason);
      adjustmentsByKey.set(key, prev);
    }

    const appliedKeys = new Set<string>();
    const sessionDtos: AttendanceSessionResponseDto[] = items.map((s) => {
      const dStr = this.formatDateOnly(s.attendanceDate);
      const key = `${s.employeeId}_${dStr}`;
      let adj = 0;
      let reason: string | undefined;
      if (!appliedKeys.has(key)) {
        const dAdj = adjustmentsByKey.get(key);
        if (dAdj) {
          adj = dAdj.seconds;
          reason = dAdj.reasons.join('; ');
          appliedKeys.add(key);
        }
      }
      return this.toSessionDto(s, s.pauses, new Date(), adj, reason);
    });

    for (const [key, dAdj] of adjustmentsByKey.entries()) {
      if (!appliedKeys.has(key) && dAdj.seconds > 0) {
        const [empId, dStr] = key.split('_');
        sessionDtos.push(
          this.createSynthesizedSpecialSession(
            empId,
            dStr,
            dAdj.exception,
            dAdj.seconds,
            dAdj.reasons.join('; '),
          ),
        );
      }
    }

    sessionDtos.sort((a, b) => {
      const dCompare = b.attendanceDate.localeCompare(a.attendanceDate);
      if (dCompare !== 0) return dCompare;
      return new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime();
    });

    const total = sessionDtos.length;
    const paginatedItems = sessionDtos.slice((page - 1) * limit, page * limit);

    return {
      items: paginatedItems,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getHistory(employeeId: string, query: HistoryQueryDto): Promise<PaginatedHistoryResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const endDate = query.endDate ? this.toDateOnly(new Date(query.endDate)) : this.toDateOnly(new Date());
    const startDate = query.startDate
      ? this.toDateOnly(new Date(query.startDate))
      : this.toDateOnly(new Date(endDate.getTime() - 29 * 24 * 60 * 60 * 1000));

    const ids = await this.resolveEmployeeIds(employeeId);
    const sessionWhere: Prisma.AttendanceSessionWhereInput = {
      employeeId: { in: ids },
      attendanceDate: { gte: startDate, lte: endDate },
    };

    const items = await this.prisma.attendanceSession.findMany({
      where: sessionWhere,
      include: { pauses: true },
      orderBy: [{ attendanceDate: 'desc' }, { checkInAt: 'desc' }],
    });

    const approvedExceptions = await this.prisma.attendanceException.findMany({
      where: {
        employeeId: { in: ids },
        attendanceDate: { gte: startDate, lte: endDate },
        type: ExceptionType.WORKING_TIME_ADJUSTMENT,
        status: ExceptionStatus.APPROVED,
      },
    });

    const adjustmentsByDate = new Map<string, { seconds: number; reasons: string[]; exception: any }>();
    for (const ex of approvedExceptions) {
      const dStr = this.formatDateOnly(ex.attendanceDate);
      const { seconds, reason } = this.extractAdjustmentFromException(ex);
      const prev = adjustmentsByDate.get(dStr) || { seconds: 0, reasons: [], exception: ex };
      prev.seconds += seconds;
      if (reason && !prev.reasons.includes(reason)) prev.reasons.push(reason);
      adjustmentsByDate.set(dStr, prev);
    }

    const appliedDates = new Set<string>();
    const sessionDtos: AttendanceSessionResponseDto[] = items.map((s) => {
      const dStr = this.formatDateOnly(s.attendanceDate);
      let adj = 0;
      let reason: string | undefined;
      if (!appliedDates.has(dStr)) {
        const dAdj = adjustmentsByDate.get(dStr);
        if (dAdj) {
          adj = dAdj.seconds;
          reason = dAdj.reasons.join('; ');
          appliedDates.add(dStr);
        }
      }
      return this.toSessionDto(s, s.pauses, new Date(), adj, reason);
    });

    for (const [dStr, dAdj] of adjustmentsByDate.entries()) {
      if (!appliedDates.has(dStr) && dAdj.seconds > 0) {
        sessionDtos.push(
          this.createSynthesizedSpecialSession(
            ids[0] || employeeId,
            dStr,
            dAdj.exception,
            dAdj.seconds,
            dAdj.reasons.join('; '),
          ),
        );
      }
    }

    sessionDtos.sort((a, b) => {
      const dCompare = b.attendanceDate.localeCompare(a.attendanceDate);
      if (dCompare !== 0) return dCompare;
      return new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime();
    });

    const total = sessionDtos.length;
    const paginatedItems = sessionDtos.slice((page - 1) * limit, page * limit);

    return {
      items: paginatedItems,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getById(employeeId: string, sessionId: string): Promise<AttendanceSessionResponseDto> {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { pauses: true },
    });

    const ids = await this.resolveEmployeeIds(employeeId);
    if (!session || !ids.includes(session.employeeId)) {
      throw new AppException(
        ErrorCodes.SESSION_NOT_FOUND,
        'Attendance session not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const approvedExceptions = await this.prisma.attendanceException.findMany({
      where: {
        employeeId: session.employeeId,
        attendanceDate: session.attendanceDate,
        type: ExceptionType.WORKING_TIME_ADJUSTMENT,
        status: ExceptionStatus.APPROVED,
      },
    });

    let totalAdjustmentSeconds = 0;
    const reasons: string[] = [];
    for (const ex of approvedExceptions) {
      const { seconds, reason } = this.extractAdjustmentFromException(ex);
      totalAdjustmentSeconds += seconds;
      if (reason && !reasons.includes(reason)) reasons.push(reason);
    }

    return this.toSessionDto(
      session,
      session.pauses,
      new Date(),
      totalAdjustmentSeconds,
      reasons.join('; '),
    );
  }

  // ---------------------------------------------------------------------
  // AUTO-CHECKOUT (called by the scheduler, see jobs/auto-checkout.scheduler.ts)
  // ---------------------------------------------------------------------
  async runAutoCheckoutSweep(batchSize: number, now: Date = new Date()): Promise<{ processed: number; skipped: number }> {
    const policy = await this.policyProvider.getPolicy('');
    if (!policy.autoCheckoutEnabled) {
      return { processed: 0, skipped: 0 };
    }

    const expired = await this.prisma.attendanceSession.findMany({
      where: { status: AttendanceStatus.PAUSED, currentGraceDeadline: { lte: now } },
      include: { pauses: true },
      take: batchSize,
    });

    // Also sweep stale unclosed sessions from previous days
    const startOfToday = this.toDateOnly(now);
    const stalePreviousDay = await this.prisma.attendanceSession.findMany({
      where: {
        status: { in: [AttendanceStatus.WORKING, AttendanceStatus.PAUSED] },
        attendanceDate: { lt: startOfToday },
      },
      include: { pauses: true },
      take: batchSize,
    });

    const sessionMap = new Map<string, SessionWithPauses>();
    for (const s of expired) sessionMap.set(s.id, s);
    for (const s of stalePreviousDay) sessionMap.set(s.id, s);
    const pendingSessions = Array.from(sessionMap.values());

    let processed = 0;
    let skipped = 0;

    for (const session of pendingSessions) {
      try {
        const handled = await this.autoCheckoutOne(session, now);
        if (handled) {
          processed += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        // One bad session must never abort the whole sweep.
        this.logger.error(
          `Auto-checkout failed for sessionId=${session.id}: ${(error as Error).message}`,
        );
      }
    }

    if (processed > 0 || skipped > 0) {
      this.logger.log(`Auto-checkout sweep: processed=${processed} skipped=${skipped}`);
    }

    return { processed, skipped };
  }

  private async autoCheckoutOne(session: SessionWithPauses, now: Date): Promise<boolean> {
    const isPaused = session.status === AttendanceStatus.PAUSED;
    const checkoutAt = isPaused ? (session.currentGraceDeadline ?? now) : now;
    const openPause = session.pauses.find((p) => p.endedAt === null);

    const totalWorkingSeconds = this.workingTimeService.calculateWorkingSeconds(
      {
        status: AttendanceStatus.CHECKED_OUT,
        checkInAt: session.checkInAt,
        checkOutAt: checkoutAt,
        currentPauseStartedAt: null,
      },
      session.pauses,
      checkoutAt,
    );

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.attendanceSession.updateMany({
        where: { id: session.id, status: { in: [AttendanceStatus.WORKING, AttendanceStatus.PAUSED] } },
        data: {
          status: AttendanceStatus.CHECKED_OUT,
          checkOutAt: checkoutAt,
          checkoutType: CheckoutType.AUTO,
          checkoutReason: isPaused ? CheckoutReason.GEOFENCE_TIMEOUT : CheckoutReason.SYSTEM_ACTION,
          totalWorkingSeconds,
          currentPauseStartedAt: null,
          currentGraceDeadline: null,
        },
      });

      // Safe if the worker runs more than once, or a manual checkout /
      // geofence return raced ahead of this sweep: count === 0 means
      // someone else already resolved this session, so skip silently.
      if (count === 0) {
        return false;
      }

      if (openPause) {
        await tx.attendancePause.updateMany({
          where: { id: openPause.id, endedAt: null },
          data: {
            endedAt: checkoutAt,
            durationSeconds: Math.max(
              0,
              Math.round((checkoutAt.getTime() - openPause.startedAt.getTime()) / 1000),
            ),
            endReason: PauseEndReason.AUTO_CHECKOUT,
          },
        });
      }

      // Deterministic, not timestamp-based, so a retry of this exact
      // transaction after a partial failure can never create a second
      // AUTO_CHECKOUT event for the same session.
      const clientEventId = `auto-checkout:${session.id}`;
      await tx.attendanceEvent.upsert({
        where: { clientEventId },
        update: {},
        create: {
          attendanceSessionId: session.id,
          employeeId: session.employeeId,
          clientEventId,
          eventType: AttendanceEventType.AUTO_CHECKOUT,
          eventTime: checkoutAt,
          source: AttendanceEventSource.SYSTEM,
        },
      });

      this.logger.log(`AUTO_CHECKOUT employeeId=${session.employeeId} sessionId=${session.id}`);
      return true;
    });
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  private requireLocation(event: { location?: LocationDto }): LocationDto {
    if (!event.location) {
      throw new AppException(
        ErrorCodes.VALIDATION_FAILED,
        'location is required for this event type',
        HttpStatus.BAD_REQUEST,
      );
    }
    return event.location;
  }

  private validateLocationAccuracy(location: LocationDto, policy: AttendancePolicy): void {
    if (location.isMocked === true) {
      this.logger.warn(`Security alert: check-in rejected due to mock/spoofed GPS provider detection`);
      throw new AppException(
        ErrorCodes.MOCK_LOCATION_DETECTED,
        'Spoofed or mock GPS provider detected. Attendance check-in from mock locations is strictly prohibited.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (
      location.accuracyMeters !== undefined &&
      location.accuracyMeters > policy.minLocationAccuracyMeters
    ) {
      throw new AppException(
        ErrorCodes.LOCATION_ACCURACY_TOO_LOW,
        `Location accuracy (${location.accuracyMeters}m) exceeds the allowed maximum (${policy.minLocationAccuracyMeters}m)`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private determineCheckInStatus(effectiveTime: Date, policy: AttendancePolicy): CheckInStatus {
    const minutesOfDay = effectiveTime.getUTCHours() * 60 + effectiveTime.getUTCMinutes();
    const windowStart = this.toMinutes(policy.checkInStartTime);
    const windowEnd = this.toMinutes(policy.checkInEndTime);
    const lateThreshold = windowStart + policy.lateThresholdMinutes;

    if (minutesOfDay < windowStart || minutesOfDay > windowEnd) {
      return CheckInStatus.EXCEPTION;
    }
    if (minutesOfDay > lateThreshold) {
      return CheckInStatus.LATE;
    }
    return CheckInStatus.ON_TIME;
  }

  private toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  /** Server-UTC calendar day. See README for the multi-timezone-office caveat. */
  private toDateOnly(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private formatDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private async findIdempotentReplay(
    clientEventId: string,
    expectedType: AttendanceEventType,
  ): Promise<ActionResult | null> {
    const existing = await this.prisma.attendanceEvent.findUnique({ where: { clientEventId } });
    if (!existing) return null;

    if (existing.eventType !== expectedType) {
      throw new AppException(
        ErrorCodes.DUPLICATE_CLIENT_EVENT_ID,
        `clientEventId was already used for a different event type (${existing.eventType})`,
      );
    }

    if (!existing.attendanceSessionId) {
      // Shouldn't happen for CHECK_IN/OUT/EXIT/RETURN (always linked),
      // but degrade gracefully rather than throwing.
      throw new AppException(ErrorCodes.CONFLICT, 'Original event has no associated session');
    }

    const session = await this.prisma.attendanceSession.findUniqueOrThrow({
      where: { id: existing.attendanceSessionId },
      include: { pauses: true },
    });

    return { session: this.toSessionDto(session, session.pauses), idempotentReplay: true };
  }

  private toSyncResult(
    clientEventId: string,
    error: unknown,
  ): SyncResponseDto['results'][number] {
    if (error instanceof AppException) {
      const body = error.getResponse() as { code?: string; message?: string };
      const status = body.code && INVALID_STATE_CODES.has(body.code)
        ? SyncResultStatus.INVALID_STATE
        : SyncResultStatus.REJECTED;
      return { clientEventId, status, message: body.message };
    }

    this.logger.error(`Unexpected error processing sync event ${clientEventId}: ${(error as Error).message}`);
    return { clientEventId, status: SyncResultStatus.REJECTED, message: 'Unexpected server error' };
  }

  private extractAdjustmentFromException(ex: { metadata?: Prisma.JsonValue | null; reason: string }) {
    const meta = (ex.metadata as Record<string, any>) || {};
    const seconds =
      Number(meta.additionalSeconds) ||
      (Number(meta.additionalMinutes) ? Number(meta.additionalMinutes) * 60 : 0) ||
      (Number(meta.additionalHours) ? Math.round(Number(meta.additionalHours) * 3600) : 0);
    return {
      seconds,
      reason: ex.reason || 'Special Condition Working Hours',
    };
  }

  private createSynthesizedSpecialSession(
    employeeId: string,
    attendanceDate: string,
    exception: { id: string; validFrom?: Date | null; validUntil?: Date | null; createdAt: Date; updatedAt: Date; reason: string },
    seconds: number,
    reason: string,
  ): AttendanceSessionResponseDto {
    const dDate = new Date(attendanceDate);
    return {
      id: `special-${exception.id}`,
      employeeId,
      officeId: 'REMOTE',
      attendanceDate,
      status: AttendanceStatus.CHECKED_OUT,
      checkInAt: exception.validFrom || dDate,
      checkOutAt: exception.validUntil || dDate,
      checkInStatus: CheckInStatus.ON_TIME,
      currentPauseStartedAt: null,
      currentGraceDeadline: null,
      checkoutType: CheckoutType.ADMIN,
      checkoutReason: CheckoutReason.ADMIN_ACTION,
      regularWorkingSeconds: 0,
      specialConditionSeconds: seconds,
      hasSpecialCondition: true,
      specialConditionStatus: 'HR Approved',
      specialConditionReason: reason || exception.reason || 'Special Condition Working Hours',
      totalWorkingSeconds: seconds,
      totalPausedSeconds: 0,
      createdAt: exception.createdAt,
      updatedAt: exception.updatedAt,
    };
  }

  private toSessionDto(
    session: {
      id: string;
      employeeId: string;
      officeId: string;
      attendanceDate: Date;
      status: AttendanceStatus;
      checkInAt: Date;
      checkOutAt: Date | null;
      checkInStatus: CheckInStatus;
      currentPauseStartedAt: Date | null;
      currentGraceDeadline: Date | null;
      checkoutType: CheckoutType | null;
      checkoutReason: CheckoutReason | null;
      totalWorkingSeconds: number;
      createdAt: Date;
      updatedAt: Date;
    },
    pauses: { startedAt: Date; endedAt: Date | null }[],
    now: Date = new Date(),
    approvedAdjustmentSeconds: number = 0,
    specialConditionReason?: string,
  ): AttendanceSessionResponseDto {
    const regularWorkingSeconds =
      session.status === AttendanceStatus.CHECKED_OUT
        ? session.totalWorkingSeconds
        : this.workingTimeService.calculateWorkingSeconds(session, pauses, now);

    const totalPausedSeconds = pauses.reduce((acc, p) => {
      const end = p.endedAt ? p.endedAt.getTime() : now.getTime();
      return acc + Math.max(0, Math.round((end - p.startedAt.getTime()) / 1000));
    }, 0);

    const specialConditionSeconds = Math.max(0, approvedAdjustmentSeconds);
    const hasSpecialCondition = specialConditionSeconds > 0;
    const totalWorkingSeconds = regularWorkingSeconds + specialConditionSeconds;

    return {
      id: session.id,
      employeeId: session.employeeId,
      officeId: session.officeId,
      attendanceDate: this.formatDateOnly(session.attendanceDate),
      status: session.status,
      checkInAt: session.checkInAt,
      checkOutAt: session.checkOutAt,
      checkInStatus: session.checkInStatus,
      currentPauseStartedAt: session.currentPauseStartedAt,
      currentGraceDeadline: session.currentGraceDeadline,
      checkoutType: session.checkoutType,
      checkoutReason: session.checkoutReason,
      regularWorkingSeconds,
      specialConditionSeconds,
      hasSpecialCondition,
      specialConditionStatus: hasSpecialCondition ? 'HR Approved' : undefined,
      specialConditionReason: specialConditionReason || undefined,
      totalWorkingSeconds,
      totalPausedSeconds,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
