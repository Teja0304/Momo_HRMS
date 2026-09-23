import { Injectable } from '@nestjs/common';
import { AttendanceStatus } from '../enums';

export interface SessionForDurationCalc {
  status: AttendanceStatus;
  checkInAt: Date;
  checkOutAt: Date | null;
  currentPauseStartedAt: Date | null;
}

export interface PauseForDurationCalc {
  startedAt: Date;
  endedAt: Date | null;
}

/**
 * The single place working duration is computed. Never store a
 * per-second ticking counter — everything is derived from
 * checkInAt / checkOutAt / pause timestamps, each time it's asked for.
 */
@Injectable()
export class WorkingTimeService {
  /**
   * - WORKING: live duration up to `now`.
   * - PAUSED: frozen at the moment the current pause started (no
   *   working time accrues while paused).
   * - CHECKED_OUT: frozen at checkOutAt.
   * Any number of finished pauses are subtracted; an unfinished pause
   * (endedAt: null) is treated as running until the calculation's own
   * reference end, so it naturally contributes zero once the session
   * itself is PAUSED (its reference end IS that pause's start).
   */
  calculateWorkingSeconds(
    session: SessionForDurationCalc,
    pauses: PauseForDurationCalc[],
    now: Date = new Date(),
  ): number {
    const referenceEnd = this.resolveReferenceEnd(session, now);
    const grossSeconds = Math.max(
      0,
      (referenceEnd.getTime() - session.checkInAt.getTime()) / 1000,
    );
    const pausedSeconds = this.sumPauseSeconds(pauses, referenceEnd);
    return Math.max(0, Math.round(grossSeconds - pausedSeconds));
  }

  private resolveReferenceEnd(session: SessionForDurationCalc, now: Date): Date {
    if (session.status === AttendanceStatus.CHECKED_OUT) {
      return session.checkOutAt ?? now;
    }
    if (session.status === AttendanceStatus.PAUSED && session.currentPauseStartedAt) {
      return session.currentPauseStartedAt;
    }
    return now;
  }

  private sumPauseSeconds(pauses: PauseForDurationCalc[], referenceEnd: Date): number {
    let total = 0;
    for (const pause of pauses) {
      const end = pause.endedAt ?? referenceEnd;
      const durationMs = end.getTime() - pause.startedAt.getTime();
      if (durationMs > 0) {
        total += durationMs / 1000;
      }
    }
    return total;
  }
}
