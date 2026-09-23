import { WorkingTimeService } from './working-time.service';
import { AttendanceStatus } from '../enums';

describe('WorkingTimeService', () => {
  const service = new WorkingTimeService();
  const d = (iso: string) => new Date(iso);

  it('computes live duration for a WORKING session with no pauses', () => {
    const seconds = service.calculateWorkingSeconds(
      {
        status: AttendanceStatus.WORKING,
        checkInAt: d('2026-09-22T09:30:00Z'),
        checkOutAt: null,
        currentPauseStartedAt: null,
      },
      [],
      d('2026-09-22T10:30:00Z'),
    );
    expect(seconds).toBe(3600); // 1 hour
  });

  it('matches the spec example: 09:30 checkin, 12:00-12:30 pause, 17:30 checkout = 7.5h', () => {
    const seconds = service.calculateWorkingSeconds(
      {
        status: AttendanceStatus.CHECKED_OUT,
        checkInAt: d('2026-09-22T09:30:00Z'),
        checkOutAt: d('2026-09-22T17:30:00Z'),
        currentPauseStartedAt: null,
      },
      [{ startedAt: d('2026-09-22T12:00:00Z'), endedAt: d('2026-09-22T12:30:00Z') }],
      d('2026-09-22T17:30:00Z'),
    );
    expect(seconds).toBe(7.5 * 3600);
  });

  it('freezes duration at the moment a session becomes PAUSED (no accrual while paused)', () => {
    const seconds = service.calculateWorkingSeconds(
      {
        status: AttendanceStatus.PAUSED,
        checkInAt: d('2026-09-22T09:30:00Z'),
        checkOutAt: null,
        currentPauseStartedAt: d('2026-09-22T12:00:00Z'),
      },
      [{ startedAt: d('2026-09-22T12:00:00Z'), endedAt: null }],
      d('2026-09-22T15:00:00Z'), // "now" is 3 hours into the pause
    );
    expect(seconds).toBe(2.5 * 3600); // 09:30 -> 12:00, not a second more
  });

  it('handles multiple finished pauses across a full day (acceptance-test shape)', () => {
    // 09:30 check-in, 12:00-12:20 pause, 14:00-15:00 pause (auto-checkout), checkout at 15:00
    const seconds = service.calculateWorkingSeconds(
      {
        status: AttendanceStatus.CHECKED_OUT,
        checkInAt: d('2026-09-22T09:30:00Z'),
        checkOutAt: d('2026-09-22T15:00:00Z'),
        currentPauseStartedAt: null,
      },
      [
        { startedAt: d('2026-09-22T12:00:00Z'), endedAt: d('2026-09-22T12:20:00Z') },
        { startedAt: d('2026-09-22T14:00:00Z'), endedAt: d('2026-09-22T15:00:00Z') },
      ],
      d('2026-09-22T15:00:00Z'),
    );
    // gross = 5.5h, paused = 20min + 60min = 80min
    expect(seconds).toBe(5.5 * 3600 - 80 * 60);
  });

  it('never returns a negative duration', () => {
    const seconds = service.calculateWorkingSeconds(
      {
        status: AttendanceStatus.WORKING,
        checkInAt: d('2026-09-22T09:30:00Z'),
        checkOutAt: null,
        currentPauseStartedAt: null,
      },
      [],
      d('2026-09-22T09:00:00Z'), // "now" before check-in (clock skew) — should clamp to 0
    );
    expect(seconds).toBe(0);
  });
});
