export interface GeofencePoint {
  latitude: number;
  longitude: number;
}

/**
 * The Attendance Service never owns or validates office polygon data —
 * that belongs to the Office/Geofence domain. This interface is the
 * only way attendance logic asks "is this point inside that office's
 * boundary?". Swap MockGeofenceProvider for a real HTTP/gRPC-backed
 * implementation once the Geofence Service exists — nothing else in
 * this codebase needs to change.
 */
export interface GeofenceProvider {
  isInsideOffice(officeId: string, latitude: number, longitude: number): Promise<boolean>;
}

export const GEOFENCE_PROVIDER = Symbol('GEOFENCE_PROVIDER');
