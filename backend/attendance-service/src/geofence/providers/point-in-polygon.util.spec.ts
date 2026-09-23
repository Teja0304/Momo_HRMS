import { isPointInPolygon } from './point-in-polygon.util';

// Matches the example office boundary given in the spec.
const OFFICE_POLYGON = [
  { latitude: 18.521, longitude: 73.856 },
  { latitude: 18.521, longitude: 73.857 },
  { latitude: 18.52, longitude: 73.857 },
  { latitude: 18.52, longitude: 73.856 },
];

describe('isPointInPolygon', () => {
  it('returns true for a point inside the polygon', () => {
    expect(isPointInPolygon({ latitude: 18.5204, longitude: 73.8567 }, OFFICE_POLYGON)).toBe(true);
  });

  it('returns false for a point clearly outside the polygon', () => {
    expect(isPointInPolygon({ latitude: 18.53, longitude: 73.87 }, OFFICE_POLYGON)).toBe(false);
  });

  it('returns false for a degenerate polygon with fewer than 3 points', () => {
    expect(
      isPointInPolygon(
        { latitude: 18.5204, longitude: 73.8567 },
        [
          { latitude: 18.521, longitude: 73.856 },
          { latitude: 18.521, longitude: 73.857 },
        ],
      ),
    ).toBe(false);
  });
});
