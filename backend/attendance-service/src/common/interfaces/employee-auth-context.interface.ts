/**
 * Identity resolved for the current request — either trusted verbatim
 * from dev-auth headers (local development only) or forwarded by the
 * API Gateway after it has already validated the caller's access token
 * against the Auth Service. The Attendance Service never authenticates
 * a user itself; it only trusts this context (see guards/employee-auth.guard.ts).
 */
export interface EmployeeAuthContext {
  employeeId: string;
  userId: string;
  roles: string[];
  /** true when resolved via ATTENDANCE_DEV_AUTH, for logging/diagnostics only */
  isDevAuth: boolean;
}
