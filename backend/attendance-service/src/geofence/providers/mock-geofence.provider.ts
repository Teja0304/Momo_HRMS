import { Injectable, Logger } from '@nestjs/common';
import { GeofencePoint, GeofenceProvider } from '../interfaces/geofence-provider.interface';
import { isPointInPolygon } from './point-in-polygon.util';

/**
 * Matches the example office boundary given in the spec, used as the
 * default polygon for office id "OFFICE-001" so the service is usable
 * out of the box in local development/testing without extra setup.
 */
const DEFAULT_OFFICE_POLYGON: GeofencePoint[] = [
  { latitude: 18.521, longitude: 73.856 },
  { latitude: 18.521, longitude: 73.857 },
  { latitude: 18.52, longitude: 73.857 },
  { latitude: 18.52, longitude: 73.856 },
];

/**
 * Development/testing stand-in for the future Geofence Service. Holds a
 * small in-memory registry of office polygons. Unknown office ids fail
 * CLOSED (treated as "not inside") rather than open, since a mistaken
 * "inside" is a security-relevant false positive for attendance.
 *
 * This is explicitly NOT how office polygons should be managed in
 * production — the Attendance Service must never own or accept polygon
 * definitions from a client (see spec §8). Swap this whole class for an
 * HTTP/gRPC client against the real Geofence Service; nothing else in
 * the codebase depends on this being a mock.
 */
@Injectable()
export class MockGeofenceProvider implements GeofenceProvider {
  private readonly logger = new Logger(MockGeofenceProvider.name);
  private readonly polygons = new Map<string, GeofencePoint[]>([
    ['OFFICE-001', DEFAULT_OFFICE_POLYGON],
  ]);

  registerPolygon(officeId: string, polygon: GeofencePoint[]): void {
    this.polygons.set(officeId, polygon);
  }

  async isInsideOffice(officeId: string, latitude: number, longitude: number): Promise<boolean> {
    const polygon = this.polygons.get(officeId);

    if (!polygon) {
      this.logger.warn(`No mock polygon registered for officeId=${officeId}; failing closed`);
      return false;
    }

    return isPointInPolygon({ latitude, longitude }, polygon);
  }
}
