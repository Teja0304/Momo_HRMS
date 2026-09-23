import { GeofencePoint } from '../interfaces/geofence-provider.interface';

/**
 * Standard ray-casting point-in-polygon test. Treats latitude/longitude
 * as a flat plane, which is an acceptable approximation for
 * office-sized polygons (tens to low hundreds of meters across) — it
 * is not accurate for very large polygons spanning significant
 * latitude, which offices don't.
 *
 * For a production implementation backed by real polygon storage,
 * MySQL 8's spatial functions (ST_Contains / ST_Within with a POLYGON
 * column) can replace this in-process check without changing the
 * GeofenceProvider interface — see README §"Geofence provider integration".
 */
export function isPointInPolygon(point: GeofencePoint, polygon: GeofencePoint[]): boolean {
  if (polygon.length < 3) {
    return false;
  }

  let inside = false;
  const { latitude: y, longitude: x } = point;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;

    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}
