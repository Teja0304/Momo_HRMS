export type AttendanceStatus = 'WORKING' | 'PAUSED' | 'COMPLETED';
export type CheckInStatus = 'ON_TIME' | 'GRACE_PERIOD' | 'LATE';
export type CheckoutType = 'NORMAL' | 'AUTO_CHECKOUT' | 'EXCEPTION';
export type CheckoutReason = 'END_OF_DAY' | 'GEOFENCE_TIMEOUT' | 'MANUAL_OVERRIDE';
export type PauseEndReason = 'GEOFENCE_RETURN' | 'AUTO_CHECKOUT' | 'MANUAL_CHECKOUT';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  accuracyMeters?: number;
}

export interface AttendancePause {
  id: string;
  attendanceSessionId?: string;
  startedAt: string;
  endedAt?: string | null;
  graceDeadline?: string | null;
  durationSeconds: number;
  endReason?: PauseEndReason | null;
}

export interface AttendanceEvent {
  id: string;
  attendanceSessionId: string;
  employeeId: string;
  eventType: 'CHECK_IN' | 'CHECK_OUT' | 'GEOFENCE_EXIT' | 'GEOFENCE_RETURN' | 'AUTO_CHECKOUT' | 'ATTENDANCE_REJECTED';
  eventTime: string;
  latitude?: number | null;
  longitude?: number | null;
  altitudeMeters?: number | null;
  accuracyMeters?: number | null;
  source: 'ONLINE' | 'OFFLINE_SYNC';
}

export interface AttendanceSession {
  id: string;
  employeeId: string;
  attendanceDate: string; // YYYY-MM-DD
  status: AttendanceStatus;
  checkInStatus: CheckInStatus;
  checkInAt: string;
  checkOutAt?: string | null;
  checkoutType?: CheckoutType | null;
  checkoutReason?: CheckoutReason | null;
  currentGraceDeadline?: string | null;
  totalWorkingSeconds: number;
  totalPausedSeconds: number;
  pauses?: AttendancePause[];
  events?: AttendanceEvent[];
}

export interface TodayAttendanceResponse {
  attendanceDate: string;
  sessions: AttendanceSession[];
  totalWorkingSecondsToday: number;
  hasActiveSession: boolean;
}

export interface PaginatedHistoryResponse {
  items: AttendanceSession[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface HistoryQuery {
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface CheckInPayload {
  officeId: string;
  location: LocationCoordinates;
  clientEventId?: string;
}

export interface CheckOutPayload {
  officeId: string;
  location?: LocationCoordinates;
  clientEventId?: string;
}

export interface GeofenceTransitionPayload {
  officeId: string;
  location: LocationCoordinates;
  clientEventId?: string;
}
