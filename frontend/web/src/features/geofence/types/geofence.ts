export interface Vertex {
  sequence?: number;
  latitude: number;
  longitude: number;
}

export interface Polygon {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
  vertices: Vertex[];
}

export interface Office {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  isActive: boolean;
  activePolygon?: Polygon | null;
}

export interface CreateOfficePayload {
  code: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  minAltitudeMeters?: number;
  maxAltitudeMeters?: number;
  isActive?: boolean;
}

export interface SetPolygonPayload {
  name?: string;
  vertices: Array<{ latitude: number; longitude: number }>;
  minAltitudeMeters?: number;
  maxAltitudeMeters?: number;
}

export interface VerifyLocationPayload {
  officeId: string;
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
}

export interface VerifyLocationResponse {
  isInside: boolean;
  officeId: string;
  officeName: string;
  distanceToBoundaryMeters: number;
  altitudeValid: boolean;
}
