import { api } from '../../../api/client';
import { GEOFENCE_API_URL } from '../../../config/env';
import type {
  CreateOfficePayload,
  Office,
  Polygon,
  SetPolygonPayload,
  VerifyLocationPayload,
  VerifyLocationResponse,
} from '../types/geofence';

interface BackendEnvelope<T> {
  success?: boolean;
  statusCode?: number;
  message?: string;
  data?: T;
}

function unwrapResponse<T>(resData: T | BackendEnvelope<T>): T {
  if (resData && typeof resData === 'object' && 'data' in resData && (resData as BackendEnvelope<T>).data !== undefined) {
    return (resData as BackendEnvelope<T>).data as T;
  }
  return resData as T;
}

/**
 * Lists all registered offices with their active geofence polygons.
 * GET /api/v1/offices
 */
export async function fetchOffices(): Promise<Office[]> {
  const response = await api.get<Office[] | BackendEnvelope<Office[]>>(`${GEOFENCE_API_URL}/offices`);
  return unwrapResponse(response.data);
}

/**
 * Retrieves single office details including active polygon vertices.
 * GET /api/v1/offices/:id
 */
export async function fetchOfficeById(id: string): Promise<Office> {
  const response = await api.get<Office | BackendEnvelope<Office>>(`${GEOFENCE_API_URL}/offices/${id}`);
  return unwrapResponse(response.data);
}

/**
 * Creates a new office profile.
 * POST /api/v1/offices
 */
export async function createOffice(payload: CreateOfficePayload): Promise<Office> {
  const response = await api.post<Office | BackendEnvelope<Office>>(`${GEOFENCE_API_URL}/offices`, payload);
  return unwrapResponse(response.data);
}

/**
 * Sets or updates the boundary polygon vertices for an office.
 * PUT /api/v1/offices/:id/polygon
 */
export async function setOfficePolygon(id: string, payload: SetPolygonPayload): Promise<Polygon> {
  const response = await api.put<Polygon | BackendEnvelope<Polygon>>(
    `${GEOFENCE_API_URL}/offices/${id}/polygon`,
    payload,
  );
  return unwrapResponse(response.data);
}

/**
 * Verifies if coordinates are inside an office polygon.
 * POST /api/v1/geofence/verify
 */
export async function verifyLocation(payload: VerifyLocationPayload): Promise<VerifyLocationResponse> {
  const response = await api.post<VerifyLocationResponse | BackendEnvelope<VerifyLocationResponse>>(
    `${GEOFENCE_API_URL}/geofence/verify`,
    payload,
  );
  return unwrapResponse(response.data);
}

/**
 * Deletes or removes geofence polygon(s) for an office.
 * DELETE /api/v1/offices/:id/polygon
 */
export async function deleteOfficePolygon(id: string, hard: boolean = true): Promise<unknown> {
  const response = await api.delete(`${GEOFENCE_API_URL}/offices/${id}/polygon`, {
    params: { hard: String(hard) },
  });
  return unwrapResponse(response.data);
}

/**
 * Deletes an office entirely including its geofence polygons.
 * DELETE /api/v1/offices/:id
 */
export async function deleteOffice(id: string, hard: boolean = true): Promise<unknown> {
  const response = await api.delete(`${GEOFENCE_API_URL}/offices/${id}`, {
    params: { hard: String(hard) },
  });
  return unwrapResponse(response.data);
}

