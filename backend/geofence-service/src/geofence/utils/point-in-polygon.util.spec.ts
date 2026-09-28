import {
  distanceToPolygonBoundaryMeters,
  haversineDistanceMeters,
  isPointInPolygon,
  validatePolygonVertices,
} from './point-in-polygon.util';

describe('Point-in-Polygon & Geodesic Calculations', () => {
  // Spec example Pune office polygon
  const puneOfficePolygon = [
    { latitude: 18.5210, longitude: 73.8560 },
    { latitude: 18.5210, longitude: 73.8570 },
    { latitude: 18.5200, longitude: 73.8570 },
    { latitude: 18.5200, longitude: 73.8560 },
  ];

  describe('isPointInPolygon', () => {
    it('returns true for a point strictly inside the polygon', () => {
      const insidePoint = { latitude: 18.5205, longitude: 73.8565 };
      expect(isPointInPolygon(insidePoint, puneOfficePolygon)).toBe(true);
    });

    it('returns false for a point outside the polygon', () => {
      const outsidePoint = { latitude: 18.5300, longitude: 73.8700 };
      expect(isPointInPolygon(outsidePoint, puneOfficePolygon)).toBe(false);
    });

    it('returns false for degenerate polygons (< 3 points)', () => {
      const degenerate = [
        { latitude: 18.5210, longitude: 73.8560 },
        { latitude: 18.5210, longitude: 73.8570 },
      ];
      expect(isPointInPolygon({ latitude: 18.5210, longitude: 73.8565 }, degenerate)).toBe(false);
    });
  });

  describe('haversineDistanceMeters', () => {
    it('calculates 0 meters for identical coordinates', () => {
      const p1 = { latitude: 18.5204, longitude: 73.8567 };
      expect(haversineDistanceMeters(p1, p1)).toBe(0);
    });

    it('calculates approximately correct distance between known points', () => {
      const p1 = { latitude: 18.5204, longitude: 73.8567 };
      const p2 = { latitude: 18.5214, longitude: 73.8567 }; // ~111 meters north
      const dist = haversineDistanceMeters(p1, p2);
      expect(dist).toBeGreaterThan(100);
      expect(dist).toBeLessThan(120);
    });
  });

  describe('distanceToPolygonBoundaryMeters', () => {
    it('returns close to 0 when coordinate is on or very near an edge', () => {
      const onEdge = { latitude: 18.5210, longitude: 73.8565 };
      const dist = distanceToPolygonBoundaryMeters(onEdge, puneOfficePolygon);
      expect(dist).toBeLessThan(5);
    });

    it('calculates positive distance from inside center to boundary', () => {
      const center = { latitude: 18.5205, longitude: 73.8565 };
      const dist = distanceToPolygonBoundaryMeters(center, puneOfficePolygon);
      expect(dist).toBeGreaterThan(20);
      expect(dist).toBeLessThan(80);
    });
  });

  describe('validatePolygonVertices', () => {
    it('validates a correct polygon with 3+ vertices', () => {
      expect(validatePolygonVertices(puneOfficePolygon)).toEqual({ valid: true });
    });

    it('rejects a polygon with less than 3 vertices', () => {
      const invalid = [
        { latitude: 18.5210, longitude: 73.8560 },
        { latitude: 18.5210, longitude: 73.8570 },
      ];
      const result = validatePolygonVertices(invalid);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 3 vertices');
    });

    it('rejects invalid latitude values', () => {
      const invalid = [
        { latitude: 95.0, longitude: 73.8560 },
        { latitude: 18.5210, longitude: 73.8570 },
        { latitude: 18.5200, longitude: 73.8570 },
      ];
      const result = validatePolygonVertices(invalid);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid coordinates');
    });
  });
});
