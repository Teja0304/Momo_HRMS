export interface AttendancePolicy {
  checkInStartTime: string; // "HH:mm", 24h, local server time
  checkInEndTime: string; // "HH:mm"
  lateThresholdMinutes: number;
  gracePeriodMinutes: number;
  autoCheckoutEnabled: boolean;
  workingHoursPerDay: number;
  allowManualCheckoutWhilePaused: boolean;
  minLocationAccuracyMeters: number;
}

/**
 * The actual policy may eventually be owned by another service (e.g. an
 * HR/Org-settings service, possibly per-office or per-employee-grade).
 * Attendance business logic asks this interface for policy values
 * instead of reading configuration directly, so no "60 minutes" /
 * "8 hours" constants are hard-coded through the codebase. V1 provides
 * a single global, environment-configured policy.
 */
export interface AttendancePolicyProvider {
  getPolicy(officeId: string): Promise<AttendancePolicy>;
}

export const ATTENDANCE_POLICY_PROVIDER = Symbol('ATTENDANCE_POLICY_PROVIDER');
