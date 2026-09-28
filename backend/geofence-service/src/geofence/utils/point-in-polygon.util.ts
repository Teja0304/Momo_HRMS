export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Standard Ray-Casting algorithm to check if a point lies inside a polygon.
 * @param point The coordinate to test.
 * @param polygon Array of coordinates defining the polygon perimeter.
 */
export function isPointInPolygon(point: Coordinate, polygon: Coordinate[]): boolean {
  if (!polygon || polygon.length < 3) {
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

/**
 * Calculate Great-Circle distance between two points in meters using the Haversine formula.
 */
export function haversineDistanceMeters(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);
  const lat1 = toRad(coord1.latitude);
  const lat2 = toRad(coord2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates the shortest distance in meters from a point to the polygon boundary edges.
 */
export function distanceToPolygonBoundaryMeters(point: Coordinate, polygon: Coordinate[]): number {
  if (polygon.length < 2) return Infinity;

  let minDistance = Infinity;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const p1 = polygon[j];
    const p2 = polygon[i];
    const dist = distanceToSegmentMeters(point, p1, p2);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return Math.round(minDistance * 100) / 100;
}

/**
 * Shortest distance from point P to line segment AB in meters.
 */
function distanceToSegmentMeters(p: Coordinate, a: Coordinate, b: Coordinate): number {
  const l2 = (b.latitude - a.latitude) ** 2 + (b.longitude - a.longitude) ** 2;
  if (l2 === 0) return haversineDistanceMeters(p, a);

  // Projection scalar t on the line AB
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.latitude - a.latitude) * (b.latitude - a.latitude) +
        (p.longitude - a.longitude) * (b.longitude - a.longitude)) /
        l2,
    ),
  );

  const projection: Coordinate = {
    latitude: a.latitude + t * (b.latitude - a.latitude),
    longitude: a.longitude + t * (b.longitude - a.longitude),
  };

  return haversineDistanceMeters(p, projection);
}

/**
 * Validates whether the given list of vertices forms a valid polygon.
 */
export function validatePolygonVertices(vertices: Coordinate[]): { valid: boolean; error?: string } {
  if (!vertices || vertices.length < 3) {
    return { valid: false, error: 'A polygon must have at least 3 vertices.' };
  }

  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    if (
      typeof v.latitude !== 'number' ||
      typeof v.longitude !== 'number' ||
      v.latitude < -90 ||
      v.latitude > 90 ||
      v.longitude < -180 ||
      v.longitude > 180
    ) {
      return { valid: false, error: `Vertex at index ${i} has invalid coordinates.` };
    }
  }

  return { valid: true };
}
