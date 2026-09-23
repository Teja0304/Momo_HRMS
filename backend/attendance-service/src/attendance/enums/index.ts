// Re-exported from the Prisma client rather than redeclared, so the
// TypeScript enums used across the app can never drift from the
// database enums generated from schema.prisma.
export {
  AttendanceStatus,
  CheckInStatus,
  CheckoutType,
  CheckoutReason,
  PauseEndReason,
  AttendanceEventType,
  AttendanceEventSource,
} from '@prisma/client';

/** API-only — not a DB enum. Result of processing one offline-synced event. */
export enum SyncResultStatus {
  PROCESSED = 'PROCESSED',
  ALREADY_PROCESSED = 'ALREADY_PROCESSED',
  REJECTED = 'REJECTED',
  INVALID_STATE = 'INVALID_STATE',
}
