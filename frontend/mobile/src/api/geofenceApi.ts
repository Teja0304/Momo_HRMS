import { geofenceClient } from './client';

export interface Office {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  isActive: boolean;
  activePolygon?: {
    id: string;
    name: string;
    version: number;
    isActive: boolean;
    vertices: Array<{
      sequence: number;
      latitude: number;
      longitude: number;
    }>;
  } | null;
}

export interface VerifyLocationPayload {
  officeId: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  altitudeMeters?: number;
}

export interface VerifyLocationResult {
  isInside: boolean;
  officeId: string;
  officeName: string;
  distanceToBoundaryMeters: number;
  altitudeValid: boolean;
}

export async function getOffices(): Promise<Office[]> {
  const { data } = await geofenceClient.get<any>('/offices');
  return data?.data ?? (Array.isArray(data) ? data : []);
}

export async function getOfficeById(idOrCode: string): Promise<Office | null> {
  try {
    const { data } = await geofenceClient.get<any>(`/offices/${encodeURIComponent(idOrCode)}`);
    return data?.data ?? data ?? null;
  } catch {
    return null;
  }
}

export async function verifyLocation(payload: VerifyLocationPayload): Promise<VerifyLocationResult> {
  const { data } = await geofenceClient.post<any>('/geofence/verify', payload);
  return data?.data ?? data;
}

/**
 * Calculates Great-Circle distance in meters between two coordinates.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Computes the center coordinates (latitude, longitude) and effective geofence
 * radius (in meters) from the active polygon vertices.
 */
export function computeOfficeLocationAndRadius(office: Office | null): {
  latitude: number;
  longitude: number;
  radiusMeters: number;
} | null {
  if (!office?.activePolygon?.vertices || office.activePolygon.vertices.length === 0) {
    return null;
  }

  const vertices = office.activePolygon.vertices;
  const total = vertices.length;
  const sumLat = vertices.reduce((acc, v) => acc + v.latitude, 0);
  const sumLng = vertices.reduce((acc, v) => acc + v.longitude, 0);

  const centerLat = sumLat / total;
  const centerLng = sumLng / total;

  // Compute radius as average distance from center to all vertices (or min 50m)
  const distances = vertices.map((v) =>
    haversineDistanceMeters(centerLat, centerLng, v.latitude, v.longitude),
  );
  const maxDistance = Math.max(...distances, 50);

  return {
    latitude: parseFloat(centerLat.toFixed(5)),
    longitude: parseFloat(centerLng.toFixed(5)),
    radiusMeters: Math.round(maxDistance),
  };
}
