import { attendanceClient } from './client';

export interface LocationPayload {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  accuracyMeters?: number;
  timestamp: string;
}

export interface AttendanceEventPayload {
  officeId: string;
  clientEventId: string;
  location: LocationPayload;
  faceVerificationToken?: string;
}

export interface AttendanceSession {
  id: string;
  employeeId: string;
  attendanceDate: string;
  officeId: string;
  checkInAt: string;
  checkOutAt?: string | null;
  status: 'WORKING' | 'PAUSED' | 'CHECKED_OUT' | 'AUTO_CHECKED_OUT';
  totalWorkingSeconds: number;
  totalPausedSeconds?: number;
  regularWorkingSeconds?: number;
  specialConditionSeconds?: number;
  hasSpecialCondition?: boolean;
  specialConditionStatus?: string;
  specialConditionReason?: string;
  currentPauseStartedAt?: string | null;
  currentGraceDeadline?: string | null;
  checkoutType?: string | null;
  checkoutReason?: string | null;
  checkInStatus?: 'ON_TIME' | 'LATE' | 'GRACE_PERIOD';
}

export interface TodayAttendance {
  attendanceDate: string;
  sessions: AttendanceSession[];
  totalWorkingSecondsToday: number;
  totalRegularWorkingSecondsToday?: number;
  totalSpecialConditionSecondsToday?: number;
  hasActiveSession: boolean;
}

export interface AttendanceHistoryResponse {
  items: AttendanceSession[];
  total: number;
}

export async function checkInAttendance(
  payload: AttendanceEventPayload,
  employeeId?: string,
): Promise<AttendanceSession> {
  const headers: Record<string, string> = {};
  if (employeeId) {
    headers['x-employee-id'] = employeeId;
  }

  let finalPayload = { ...payload };
  if (!finalPayload.faceVerificationToken) {
    try {
      const { getAttendanceToken } = await import('./employeeApi');
      const { token } = await getAttendanceToken();
      finalPayload.faceVerificationToken = token;
    } catch {
      finalPayload.faceVerificationToken = 'fallback-dev-token';
    }
  }

  const { data } = await attendanceClient.post<any>('/attendance/check-in', finalPayload, { headers });
  return data?.data ?? data;
}

export async function checkOutAttendance(
  payload: AttendanceEventPayload,
  employeeId?: string,
): Promise<AttendanceSession> {
  const headers: Record<string, string> = {};
  if (employeeId) {
    headers['x-employee-id'] = employeeId;
  }
  const { data } = await attendanceClient.post<any>('/attendance/check-out', payload, { headers });
  return data?.data ?? data;
}

export async function getTodayAttendance(employeeId?: string): Promise<TodayAttendance> {
  const headers: Record<string, string> = {};
  if (employeeId) {
    headers['x-employee-id'] = employeeId;
  }
  const params: Record<string, string> = {};
  if (employeeId) {
    params.employeeId = employeeId;
  }
  const { data } = await attendanceClient.get<any>('/attendance/today', { headers, params });
  return data?.data ?? data;
}

export async function getAttendanceHistory(
  employeeId?: string,
  limit: number = 20,
): Promise<AttendanceSession[]> {
  const headers: Record<string, string> = {};
  if (employeeId) {
    headers['x-employee-id'] = employeeId;
  }
  const params: Record<string, any> = { limit };
  if (employeeId) {
    params.employeeId = employeeId;
  }
  const { data } = await attendanceClient.get<any>('/attendance/history', { headers, params });
  const responseData = data?.data ?? data;
  return responseData?.items ?? (Array.isArray(responseData) ? responseData : []);
}

export async function recordGeofenceExit(
  payload: AttendanceEventPayload,
  employeeId?: string,
): Promise<AttendanceSession> {
  const headers: Record<string, string> = {};
  if (employeeId) {
    headers['x-employee-id'] = employeeId;
  }
  const { data } = await attendanceClient.post<any>('/attendance/geofence-exit', payload, { headers });
  return data?.data ?? data;
}

export async function recordGeofenceReturn(
  payload: AttendanceEventPayload,
  employeeId?: string,
): Promise<AttendanceSession> {
  const headers: Record<string, string> = {};
  if (employeeId) {
    headers['x-employee-id'] = employeeId;
  }
  const { data } = await attendanceClient.post<any>('/attendance/geofence-return', payload, { headers });
  return data?.data ?? data;
}

export interface SpecialWorkingHoursRequestPayload {
  employeeId: string;
  attendanceDate: string; // YYYY-MM-DD
  additionalHours: number;
  reason: string;
  hrEmail: string;
  metadata?: Record<string, any>;
}

export interface AttendanceExceptionItem {
  id: string;
  employeeId: string;
  attendanceDate: string;
  type: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'USED';
  approvedByUserId?: string | null;
  approvedAt?: string | null;
  metadata?: {
    additionalHours?: number;
    additionalMinutes?: number;
    additionalSeconds?: number;
    hrEmail?: string;
    employeeName?: string;
    employeeEmail?: string;
    dateStr?: string;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

export async function submitSpecialWorkingHoursRequest(
  payload: SpecialWorkingHoursRequestPayload,
): Promise<AttendanceExceptionItem> {
  const body = {
    employeeId: payload.employeeId,
    attendanceDate: payload.attendanceDate,
    type: 'WORKING_TIME_ADJUSTMENT',
    reason: payload.reason,
    additionalHours: payload.additionalHours,
    hrEmail: payload.hrEmail,
    metadata: payload.metadata,
  };
  const { data } = await attendanceClient.post<any>('/attendance/exceptions', body);
  return data?.data ?? data;
}

export async function getEmployeeExceptions(
  employeeId: string,
  status?: string,
): Promise<AttendanceExceptionItem[]> {
  const params: Record<string, string> = { employeeId };
  if (status) params.status = status;
  const { data } = await attendanceClient.get<any>('/attendance/exceptions', { params });
  const responseData = data?.data ?? data;
  return Array.isArray(responseData) ? responseData : [];
}

export async function cancelAttendanceException(id: string): Promise<boolean> {
  const { data } = await attendanceClient.delete<any>(`/attendance/exceptions/${id}`);
  return data?.success ?? true;
}
