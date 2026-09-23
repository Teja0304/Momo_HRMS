import { AttendanceService } from './attendance.service';
import { WorkingTimeService } from './working-time.service';
import { FakePrismaService } from '../../testing/fake-prisma.testutil';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCodes } from '../../common/constants/error-codes';
import {
  AttendanceEventType,
  AttendanceStatus,
  CheckoutReason,
  CheckoutType,
  SyncResultStatus,
} from '../enums';
import { AttendancePolicy } from '../../policy/interfaces/attendance-policy-provider.interface';

const EMPLOYEE_ID = 'EMP-001';
const OFFICE_ID = 'OFFICE-001';

const DEFAULT_POLICY: AttendancePolicy = {
  checkInStartTime: '07:00',
  checkInEndTime: '10:00',
  lateThresholdMinutes: 15,
  gracePeriodMinutes: 60,
  autoCheckoutEnabled: true,
  workingHoursPerDay: 8,
  allowManualCheckoutWhilePaused: false,
  minLocationAccuracyMeters: 50,
};

function buildLocationEvent(clientEventId: string, timestamp: string) {
  return {
    officeId: OFFICE_ID,
    location: { latitude: 18.5204, longitude: 73.8567, accuracyMeters: 10, timestamp },
    clientEventId,
  };
}

function createTestBed(policyOverrides: Partial<AttendancePolicy> = {}) {
  const prisma = new FakePrismaService();
  const geofenceProvider = { isInsideOffice: jest.fn().mockResolvedValue(true) };
  const employeeProvider = { isAssignedToOffice: jest.fn().mockResolvedValue(true) };
  const policyProvider = {
    getPolicy: jest.fn().mockResolvedValue({ ...DEFAULT_POLICY, ...policyOverrides }),
  };

  const service = new AttendanceService(
    prisma as any,
    new WorkingTimeService(),
    geofenceProvider as any,
    employeeProvider as any,
    policyProvider as any,
  );

  return { service, prisma, geofenceProvider, employeeProvider, policyProvider };
}

describe('AttendanceService', () => {
  describe('check-in', () => {
    it('creates a WORKING session', async () => {
      const { service } = createTestBed();
      const result = await service.checkIn(
        EMPLOYEE_ID,
        buildLocationEvent('ci-1', '2026-09-22T09:30:00Z'),
        new Date('2026-09-22T09:30:00Z'),
      );

      expect(result.idempotentReplay).toBe(false);
      expect(result.session.status).toBe(AttendanceStatus.WORKING);
      expect(result.session.employeeId).toBe(EMPLOYEE_ID);
      // Default policy: window 07:00-10:00, 15-min late threshold from
      // window start (07:15 cutoff) — 09:30 is within the window but past
      // the late threshold, so LATE is the correct classification here.
      expect(result.session.checkInStatus).toBe('LATE');
    });

    it('rejects a duplicate check-in while already active', async () => {
      const { service } = createTestBed();
      await service.checkIn(EMPLOYEE_ID, buildLocationEvent('ci-1', '2026-09-22T09:30:00Z'));

      await expect(
        service.checkIn(EMPLOYEE_ID, buildLocationEvent('ci-2', '2026-09-22T09:31:00Z')),
      ).rejects.toMatchObject({
        response: { code: ErrorCodes.ATTENDANCE_ALREADY_ACTIVE },
      });
    });

    it('is idempotent when the same clientEventId is submitted twice', async () => {
      const { service, prisma } = createTestBed();
      const first = await service.checkIn(
        EMPLOYEE_ID,
        buildLocationEvent('ci-same', '2026-09-22T09:30:00Z'),
      );
      const second = await service.checkIn(
        EMPLOYEE_ID,
        buildLocationEvent('ci-same', '2026-09-22T09:30:00Z'),
      );

      expect(first.idempotentReplay).toBe(false);
      expect(second.idempotentReplay).toBe(true);
      expect(second.session.id).toBe(first.session.id);
      expect(prisma.events.filter((e) => e.clientEventId === 'ci-same')).toHaveLength(1);
      expect(prisma.sessions).toHaveLength(1);
    });

    it('rejects reusing a clientEventId for a different event type', async () => {
      const { service } = createTestBed();
      await service.checkIn(EMPLOYEE_ID, buildLocationEvent('reused-id', '2026-09-22T09:30:00Z'));
      await service.checkOut(EMPLOYEE_ID, { clientEventId: 'checkout-1' }, new Date('2026-09-22T17:00:00Z'));

      await expect(
        service.geofenceExit(EMPLOYEE_ID, buildLocationEvent('reused-id', '2026-09-22T10:00:00Z')),
      ).rejects.toMatchObject({ response: { code: ErrorCodes.DUPLICATE_CLIENT_EVENT_ID } });
    });

    it('rejects an employee not assigned to the office', async () => {
      const { service, employeeProvider } = createTestBed();
      employeeProvider.isAssignedToOffice.mockResolvedValueOnce(false);

      await expect(
        service.checkIn(EMPLOYEE_ID, buildLocationEvent('ci-1', '2026-09-22T09:30:00Z')),
      ).rejects.toMatchObject({ response: { code: ErrorCodes.EMPLOYEE_NOT_ASSIGNED_TO_OFFICE } });
    });

    it('rejects check-in outside the geofence', async () => {
      const { service, geofenceProvider } = createTestBed();
      geofenceProvider.isInsideOffice.mockResolvedValueOnce(false);

      await expect(
        service.checkIn(EMPLOYEE_ID, buildLocationEvent('ci-1', '2026-09-22T09:30:00Z')),
      ).rejects.toMatchObject({ response: { code: ErrorCodes.OUTSIDE_GEOFENCE } });
    });

    it('rejects a re-check-in on the same date after a completed session', async () => {
      const { service } = createTestBed();
      await service.checkIn(
        EMPLOYEE_ID,
        buildLocationEvent('ci-1', '2026-09-22T09:30:00Z'),
        new Date('2026-09-22T09:30:00Z'),
      );
      await service.checkOut(
        EMPLOYEE_ID,
        { clientEventId: 'co-1' },
        new Date('2026-09-22T17:00:00Z'),
      );

      await expect(
        service.checkIn(
          EMPLOYEE_ID,
          buildLocationEvent('ci-2', '2026-09-22T17:30:00Z'),
          new Date('2026-09-22T17:30:00Z'),
        ),
      ).rejects.toMatchObject({ response: { code: ErrorCodes.ATTENDANCE_ALREADY_COMPLETED } });
    });
  });

  describe('check-out', () => {
    it('rejects checkout with no active session', async () => {
      const { service } = createTestBed();
      await expect(
        service.checkOut(EMPLOYEE_ID, { clientEventId: 'co-1' }),
      ).rejects.toMatchObject({ response: { code: ErrorCodes.NO_ACTIVE_SESSION } });
    });

    it('computes working duration and closes the session', async () => {
      const { service } = createTestBed();
      await service.checkIn(
        EMPLOYEE_ID,
        buildLocationEvent('ci-1', '2026-09-22T09:30:00Z'),
        new Date('2026-09-22T09:30:00Z'),
      );
      const result = await service.checkOut(
        EMPLOYEE_ID,
        { clientEventId: 'co-1' },
        new Date('2026-09-22T17:30:00Z'),
      );

      expect(result.session.status).toBe(AttendanceStatus.CHECKED_OUT);
      expect(result.session.checkoutType).toBe(CheckoutType.MANUAL);
      expect(result.session.checkoutReason).toBe(CheckoutReason.USER_CHECKOUT);
      expect(result.session.totalWorkingSeconds).toBe(8 * 3600);
    });

    it('rejects manual checkout while PAUSED by default policy', async () => {
      const { service } = createTestBed();
      await service.checkIn(
        EMPLOYEE_ID,
        buildLocationEvent('ci-1', '2026-09-22T09:30:00Z'),
        new Date('2026-09-22T09:30:00Z'),
      );
      await service.geofenceExit(
        EMPLOYEE_ID,
        buildLocationEvent('exit-1', '2026-09-22T12:00:00Z'),
        new Date('2026-09-22T12:00:00Z'),
      );

      await expect(
        service.checkOut(EMPLOYEE_ID, { clientEventId: 'co-1' }, new Date('2026-09-22T12:30:00Z')),
      ).rejects.toMatchObject({ response: { code: ErrorCodes.CHECKOUT_WHILE_PAUSED_NOT_ALLOWED } });
    });
  });

  describe('geofence exit / return', () => {
    it('pauses on exit and sets a grace deadline from policy', async () => {
      const { service } = createTestBed({ gracePeriodMinutes: 60 });
      await service.checkIn(
        EMPLOYEE_ID,
        buildLocationEvent('ci-1', '2026-09-22T09:30:00Z'),
        new Date('2026-09-22T09:30:00Z'),
      );
      const result = await service.geofenceExit(
        EMPLOYEE_ID,
        buildLocationEvent('exit-1', '2026-09-22T12:00:00Z'),
        new Date('2026-09-22T12:00:00Z'),
      );

      expect(result.session.status).toBe(AttendanceStatus.PAUSED);
      expect(result.session.currentGraceDeadline?.toISOString()).toBe('2026-09-22T13:00:00.000Z');
    });

    it('rejects geofence-exit if the location still reports inside', async () => {
      const { service, geofenceProvider } = createTestBed();
      await service.checkIn(EMPLOYEE_ID, buildLocationEvent('ci-1', '2026-09-22T09:30:00Z'));
      geofenceProvider.isInsideOffice.mockResolvedValueOnce(true);

      await expect(
        service.geofenceExit(EMPLOYEE_ID, buildLocationEvent('exit-1', '2026-09-22T12:00:00Z')),
      ).rejects.toMatchObject({ response: { code: ErrorCodes.STILL_INSIDE_GEOFENCE } });
    });

    it('resumes WORKING on return and closes the pause with a duration', async () => {
      const { service } = createTestBed();
      await service.checkIn(
        EMPLOYEE_ID,
        buildLocationEvent('ci-1', '2026-09-22T09:30:00Z'),
        new Date('2026-09-22T09:30:00Z'),
      );
      await service.geofenceExit(
        EMPLOYEE_ID,
        buildLocationEvent('exit-1', '2026-09-22T12:00:00Z'),
        new Date('2026-09-22T12:00:00Z'),
      );
      const result = await service.geofenceReturn(
        EMPLOYEE_ID,
        buildLocationEvent('return-1', '2026-09-22T12:20:00Z'),
        new Date('2026-09-22T12:20:00Z'),
      );

      expect(result.session.status).toBe(AttendanceStatus.WORKING);
      expect(result.session.currentPauseStartedAt).toBeNull();
      expect(result.session.currentGraceDeadline).toBeNull();
    });

    it('rejects geofence-return if not actually back inside', async () => {
      const { service, geofenceProvider } = createTestBed();
      await service.checkIn(EMPLOYEE_ID, buildLocationEvent('ci-1', '2026-09-22T09:30:00Z'));
      await service.geofenceExit(EMPLOYEE_ID, buildLocationEvent('exit-1', '2026-09-22T12:00:00Z'));
      geofenceProvider.isInsideOffice.mockResolvedValueOnce(false);

      await expect(
        service.geofenceReturn(EMPLOYEE_ID, buildLocationEvent('return-1', '2026-09-22T12:20:00Z')),
      ).rejects.toMatchObject({ response: { code: ErrorCodes.OUTSIDE_GEOFENCE } });
    });
  });

  describe('auto-checkout sweep', () => {
    it('closes a session whose grace period has expired', async () => {
      const { service } = createTestBed();
      await service.checkIn(
        EMPLOYEE_ID,
        buildLocationEvent('ci-1', '2026-09-22T09:30:00Z'),
        new Date('2026-09-22T09:30:00Z'),
      );
      await service.geofenceExit(
        EMPLOYEE_ID,
        buildLocationEvent('exit-1', '2026-09-22T14:00:00Z'),
        new Date('2026-09-22T14:00:00Z'),
      );

      const { processed } = await service.runAutoCheckoutSweep(100, new Date('2026-09-22T15:00:00Z'));
      expect(processed).toBe(1);

      const today = await service.getToday(EMPLOYEE_ID, new Date('2026-09-22T16:00:00Z'));
      const session = today.sessions[0];
      expect(session.status).toBe(AttendanceStatus.CHECKED_OUT);
      expect(session.checkoutType).toBe(CheckoutType.AUTO);
      expect(session.checkoutReason).toBe(CheckoutReason.GEOFENCE_TIMEOUT);
    });

    it('is a no-op when run twice (safe under duplicate scheduler runs)', async () => {
      const { service } = createTestBed();
      await service.checkIn(EMPLOYEE_ID, buildLocationEvent('ci-1', '2026-09-22T09:30:00Z'), new Date('2026-09-22T09:30:00Z'));
      await service.geofenceExit(EMPLOYEE_ID, buildLocationEvent('exit-1', '2026-09-22T14:00:00Z'), new Date('2026-09-22T14:00:00Z'));

      const first = await service.runAutoCheckoutSweep(100, new Date('2026-09-22T15:00:00Z'));
      const second = await service.runAutoCheckoutSweep(100, new Date('2026-09-22T15:05:00Z'));

      expect(first.processed).toBe(1);
      expect(second.processed).toBe(0);
      expect(second.skipped).toBe(0); // session is no longer PAUSED, so it's not even picked up
    });

    it('does nothing when auto-checkout is disabled by policy', async () => {
      const { service } = createTestBed({ autoCheckoutEnabled: false });
      await service.checkIn(EMPLOYEE_ID, buildLocationEvent('ci-1', '2026-09-22T09:30:00Z'), new Date('2026-09-22T09:30:00Z'));
      await service.geofenceExit(EMPLOYEE_ID, buildLocationEvent('exit-1', '2026-09-22T14:00:00Z'), new Date('2026-09-22T14:00:00Z'));

      const { processed } = await service.runAutoCheckoutSweep(100, new Date('2026-09-22T20:00:00Z'));
      expect(processed).toBe(0);
    });
  });

  describe('offline sync', () => {
    it('processes a batch of offline events and reports PROCESSED / ALREADY_PROCESSED / REJECTED', async () => {
      const { service } = createTestBed();
      // Pre-existing online check-in with the same clientEventId as one
      // of the offline events, to prove ALREADY_PROCESSED works via sync too.
      await service.checkIn(
        EMPLOYEE_ID,
        buildLocationEvent('sync-ci-1', '2026-09-22T09:30:00Z'),
        new Date('2026-09-22T09:30:00Z'),
      );

      const response = await service.sync(EMPLOYEE_ID, {
        events: [
          {
            clientEventId: 'sync-ci-1',
            eventType: AttendanceEventType.CHECK_IN,
            eventTime: '2026-09-22T09:30:00Z',
            officeId: OFFICE_ID,
            location: { latitude: 18.5204, longitude: 73.8567, timestamp: '2026-09-22T09:30:00Z' },
          },
          {
            clientEventId: 'sync-exit-1',
            eventType: AttendanceEventType.GEOFENCE_EXIT,
            eventTime: '2026-09-22T12:00:00Z',
            officeId: OFFICE_ID,
            location: { latitude: 18.5204, longitude: 73.8567, timestamp: '2026-09-22T12:00:00Z' },
          },
          {
            clientEventId: 'sync-bad-checkin',
            eventType: AttendanceEventType.CHECK_IN,
            eventTime: '2026-09-22T13:00:00Z',
            officeId: OFFICE_ID,
            location: { latitude: 18.5204, longitude: 73.8567, timestamp: '2026-09-22T13:00:00Z' },
          },
        ],
      });

      expect(response.results).toEqual([
        { clientEventId: 'sync-ci-1', status: SyncResultStatus.ALREADY_PROCESSED },
        { clientEventId: 'sync-exit-1', status: SyncResultStatus.PROCESSED },
        expect.objectContaining({
          clientEventId: 'sync-bad-checkin',
          status: SyncResultStatus.INVALID_STATE, // already has an active (now PAUSED) session
        }),
      ]);
    });
  });

  describe('acceptance scenario (spec §37)', () => {
    it('reproduces the full E001 timeline end to end', async () => {
      const { service } = createTestBed({ gracePeriodMinutes: 60 });

      await service.checkIn(
        EMPLOYEE_ID,
        buildLocationEvent('e001-checkin', '2026-09-22T09:30:00Z'),
        new Date('2026-09-22T09:30:00Z'),
      );

      const afterExit1 = await service.geofenceExit(
        EMPLOYEE_ID,
        buildLocationEvent('e001-exit-1', '2026-09-22T12:00:00Z'),
        new Date('2026-09-22T12:00:00Z'),
      );
      expect(afterExit1.session.currentGraceDeadline?.toISOString()).toBe('2026-09-22T13:00:00.000Z');

      await service.geofenceReturn(
        EMPLOYEE_ID,
        buildLocationEvent('e001-return-1', '2026-09-22T12:20:00Z'),
        new Date('2026-09-22T12:20:00Z'),
      );

      const afterExit2 = await service.geofenceExit(
        EMPLOYEE_ID,
        buildLocationEvent('e001-exit-2', '2026-09-22T14:00:00Z'),
        new Date('2026-09-22T14:00:00Z'),
      );
      expect(afterExit2.session.currentGraceDeadline?.toISOString()).toBe('2026-09-22T15:00:00.000Z');

      const { processed } = await service.runAutoCheckoutSweep(100, new Date('2026-09-22T15:00:00Z'));
      expect(processed).toBe(1);

      const finalSession = await service.getById(EMPLOYEE_ID, afterExit1.session.id);
      expect(finalSession.status).toBe(AttendanceStatus.CHECKED_OUT);
      expect(finalSession.checkoutType).toBe(CheckoutType.AUTO);
      expect(finalSession.checkoutReason).toBe(CheckoutReason.GEOFENCE_TIMEOUT);
      expect(finalSession.checkInAt.toISOString()).toBe('2026-09-22T09:30:00.000Z');
      expect(finalSession.checkOutAt?.toISOString()).toBe('2026-09-22T15:00:00.000Z');
      // Working periods: 09:30->12:00 (2.5h) and 12:20->14:00 (1h40m).
      // The 12:00-12:20 pause and the 14:00-15:00 auto-checkout pause
      // both correctly count as non-working time.
      expect(finalSession.totalWorkingSeconds).toBe(2.5 * 3600 + 100 * 60);
    });

    it('records the exact event sequence: CHECK_IN, GEOFENCE_EXIT, GEOFENCE_RETURN, GEOFENCE_EXIT, AUTO_CHECKOUT', async () => {
      const { service, prisma } = createTestBed({ gracePeriodMinutes: 60 });

      await service.checkIn(EMPLOYEE_ID, buildLocationEvent('e2-checkin', '2026-09-22T09:30:00Z'), new Date('2026-09-22T09:30:00Z'));
      await service.geofenceExit(EMPLOYEE_ID, buildLocationEvent('e2-exit-1', '2026-09-22T12:00:00Z'), new Date('2026-09-22T12:00:00Z'));
      await service.geofenceReturn(EMPLOYEE_ID, buildLocationEvent('e2-return-1', '2026-09-22T12:20:00Z'), new Date('2026-09-22T12:20:00Z'));
      await service.geofenceExit(EMPLOYEE_ID, buildLocationEvent('e2-exit-2', '2026-09-22T14:00:00Z'), new Date('2026-09-22T14:00:00Z'));
      await service.runAutoCheckoutSweep(100, new Date('2026-09-22T15:00:00Z'));

      const eventTypes = prisma.events
        .sort((a: any, b: any) => a.eventTime.getTime() - b.eventTime.getTime())
        .map((e: any) => e.eventType);

      expect(eventTypes).toEqual([
        AttendanceEventType.CHECK_IN,
        AttendanceEventType.GEOFENCE_EXIT,
        AttendanceEventType.GEOFENCE_RETURN,
        AttendanceEventType.GEOFENCE_EXIT,
        AttendanceEventType.AUTO_CHECKOUT,
      ]);
    });
  });

  describe('getById', () => {
    it('returns SESSION_NOT_FOUND for another employee\u2019s session', async () => {
      const { service } = createTestBed();
      const { session } = await service.checkIn(
        EMPLOYEE_ID,
        buildLocationEvent('ci-1', '2026-09-22T09:30:00Z'),
      );

      await expect(service.getById('SOMEONE-ELSE', session.id)).rejects.toThrow(AppException);
    });
  });
});
