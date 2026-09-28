import { api } from '../../../api/client';
import { ATTENDANCE_API_URL } from '../../../config/env';
import type {
  AttendanceSession,
  CheckInPayload,
  CheckOutPayload,
  GeofenceTransitionPayload,
  HistoryQuery,
  LocationCoordinates,
  PaginatedHistoryResponse,
  TodayAttendanceResponse,
} from '../types/attendance';

interface BackendEnvelope<T> {
  success?: boolean;
  statusCode?: number;
  message?: string;
  data?: T;
}

/**
 * Normalizes responses: attendance-service controller returns either the raw entity
 * or an envelope depending on interceptor/decorator.
 */
function unwrapResponse<T>(resData: T | BackendEnvelope<T>): T {
  if (resData && typeof resData === 'object' && 'data' in resData && (resData as BackendEnvelope<T>).data !== undefined) {
    return (resData as BackendEnvelope<T>).data as T;
  }
  return resData as T;
}

/**
 * Fetches today's attendance summary for the authenticated user/employee.
 * GET /api/v1/attendance/today
 */
export async function fetchTodayAttendance(): Promise<TodayAttendanceResponse> {
  const response = await api.get<TodayAttendanceResponse | BackendEnvelope<TodayAttendanceResponse>>(
    `${ATTENDANCE_API_URL}/today`,
  );
  return unwrapResponse(response.data);
}

/**
 * Fetches attendance history with optional date range and pagination.
 * GET /api/v1/attendance/history?startDate=...&endDate=...&page=...&limit=...
 */
export async function fetchAttendanceHistory(
  query: HistoryQuery = {},
): Promise<PaginatedHistoryResponse> {
  const params: Record<string, string | number> = {};
  if (query.startDate) params.startDate = query.startDate;
  if (query.endDate) params.endDate = query.endDate;
  if (query.page) params.page = query.page;
  if (query.limit) params.limit = query.limit;

  const response = await api.get<PaginatedHistoryResponse | BackendEnvelope<PaginatedHistoryResponse>>(
    `${ATTENDANCE_API_URL}/history`,
    { params },
  );
  return unwrapResponse(response.data);
}

/**
 * Fetches a single attendance session by its ID.
 * GET /api/v1/attendance/:sessionId
 */
export async function fetchAttendanceById(sessionId: string): Promise<AttendanceSession> {
  const response = await api.get<AttendanceSession | BackendEnvelope<AttendanceSession>>(
    `${ATTENDANCE_API_URL}/${sessionId}`,
  );
  return unwrapResponse(response.data);
}

/**
 * Records an employee check-in with office and geolocation.
 * POST /api/v1/attendance/check-in
 */
export async function checkInAttendance(payload: CheckInPayload): Promise<AttendanceSession> {
  const response = await api.post<AttendanceSession | BackendEnvelope<AttendanceSession>>(
    `${ATTENDANCE_API_URL}/check-in`,
    payload,
  );
  return unwrapResponse(response.data);
}

/**
 * Records an employee check-out.
 * POST /api/v1/attendance/check-out
 */
export async function checkOutAttendance(payload: CheckOutPayload): Promise<AttendanceSession> {
  const response = await api.post<AttendanceSession | BackendEnvelope<AttendanceSession>>(
    `${ATTENDANCE_API_URL}/check-out`,
    payload,
  );
  return unwrapResponse(response.data);
}

/**
 * Records a geofence exit (transitions session to PAUSED).
 * POST /api/v1/attendance/geofence-exit
 */
export async function recordGeofenceExit(
  payload: GeofenceTransitionPayload,
): Promise<AttendanceSession> {
  const response = await api.post<AttendanceSession | BackendEnvelope<AttendanceSession>>(
    `${ATTENDANCE_API_URL}/geofence-exit`,
    payload,
  );
  return unwrapResponse(response.data);
}

/**
 * Records a geofence return (resumes session to WORKING).
 * POST /api/v1/attendance/geofence-return
 */
export async function recordGeofenceReturn(
  payload: GeofenceTransitionPayload,
): Promise<AttendanceSession> {
  const response = await api.post<AttendanceSession | BackendEnvelope<AttendanceSession>>(
    `${ATTENDANCE_API_URL}/geofence-return`,
    payload,
  );
  return unwrapResponse(response.data);
}

/**
 * Browser geolocation helper: retrieves current GPS coordinates.
 */
export function getCurrentCoordinates(): Promise<LocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: parseFloat(pos.coords.latitude.toFixed(6)),
          longitude: parseFloat(pos.coords.longitude.toFixed(6)),
          altitudeMeters: pos.coords.altitude ? Math.round(pos.coords.altitude) : undefined,
          accuracyMeters: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : undefined,
        });
      },
      (err) => {
        let msg = 'Unable to determine location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission was denied. Please allow location access to record attendance.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Location information is unavailable.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location request timed out. Please try again.';
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      },
    );
  });
}
