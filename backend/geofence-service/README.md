# Geofence & Office Boundary Microservice (`geofence-service`)

> **Momo HRMS — High-Precision Spatial Geometry, Multi-Point Polygon Geofencing & 3D Elevation Engine**  
> Manages physical office workplace boundaries, executes sub-millisecond Ray-Casting point-in-polygon containment algorithms, computes geodesic Haversine distance-to-boundary projections, and enforces floor-level altitude boundaries.

---

## 1. Executive Summary & Problem Solved

The **Geofence Service** is the geospatial source of truth for the **Smart Employee Attendance & Management System (Momo HRMS)**.

In automated attendance systems, physical location verification is the first line of defense against fraud. However, **standard circular radius geofencing (Center Point + $R$ meters) fails in enterprise environments**:
1. **Unwanted Road & Coffee Shop Coverage**: A circle drawn around an office building invariably spills over onto adjacent streets, parking lots, food courts, and nearby metro stations. Employees can clock in without entering the building.
2. **Irregular Campus Geography**: Modern corporate towers, tech parks, and factories are non-circular (L-shaped wings, rectangular buildings, quadrilaterals, or trapezoids).
3. **Multi-Tenant IT Complexes**: In shared corporate parks, circular radii overlap with other corporate tenancies, causing false check-ins across different companies.

> **System Law**: All geofences in Momo HRMS must be defined as **arbitrary $N$-sided polygons ($\ge 3$ vertices)**. Center-point + radius geofencing is prohibited.

---

## 2. Microservice Boundaries & Architectural Principles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MOMO HRMS ECOSYSTEM                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                             API GATEWAY (Port 8000)
                                       │
                      ┌────────────────┴────────────────┐
                      │                                 │
                      ▼                                 ▼
             Attendance Service                 Geofence Service
                (Port 3002)                       (Port 3003)
                      │                                 │
                      ├──► "Verify Point (lat, lng) ────┤
                      │    for office OFFICE-001"       │
                      │                                 ▼
                      │                       1. Fetch Active Polygon
                      │                       2. Ray-Casting Test (Jordan Curve)
                      │                       3. Haversine Orthogonal Projection
                      │                       4. Altitude Range Check
                      │                                 │
                      │◄── Returns: { isInside: true, ──┘
                      │      distanceToBoundaryMeters }
```

### What This Service OWNS:
1. **Offices Catalog**: Official office branches (`code`, `name`, `address`, `city`, `country`), operational status, and floor altitude bounds (`minAltitudeMeters`, `maxAltitudeMeters`).
2. **Geofence Polygons & Vertices**: Arbitrary $N$-sided polygon definitions with sequential coordinate vertices $(lat, lng)$, versioning, and historical tracking.
3. **Spatial Verification Engine**: Ray-Casting point-in-polygon verification and orthogonal boundary distance projection.

### What This Service DOES NOT OWN:
- **No Employee Data**: Does not know employee identities, roles, or which employee belongs to which office (owned by `employee-service`).
- **No Attendance Timesheets**: Does not store clock-in times or working hours (owned by `attendance-service`).
- **No User Credentials**: Passwords and tokens belong to `auth-service`.

---

## 3. Mathematical & Algorithmic Foundations

### A. Jordan Curve / Ray-Casting Algorithm (`point-in-polygon.util.ts`)
To determine if a user coordinate $P(x_0, y_0)$ lies inside an arbitrary polygon defined by $N$ sequential vertices $V = \{(x_1, y_1), (x_2, y_2), \dots, (x_n, y_n)\}$:
- A horizontal test ray is projected from $P(x_0, y_0)$ eastward toward infinity ($+\infty$).
- For each polygon edge $E_i = (V_i, V_{i+1})$, the algorithm calculates whether the ray intersects the line segment:
  $$\text{intersect} \iff (y_i > y_0) \neq (y_{i+1} > y_0) \land x_0 < \frac{(x_{i+1} - x_i)(y_0 - y_i)}{y_{i+1} - y_i} + x_i$$
- **Odd-Even Rule**:
  - If the ray crosses boundary edges an **odd number of times**, the point is **INSIDE**.
  - If the ray crosses boundary edges an **even number of times**, the point is **OUTSIDE**.
- **Performance**: $O(N)$ time complexity where $N$ is the vertex count (typically 4 to 12 vertices), executing in **under 0.2 milliseconds**.

### B. Geodesic Orthogonal Boundary Distance Projection (Haversine)
To provide real-time distance feedback to users (e.g., *"You are 35 meters outside the office perimeter"*):
1. Projects the user's coordinate perpendicularly onto each segment of the polygon perimeter.
2. If the perpendicular projection falls between the two endpoints of the segment, computes the great-circle distance using the **Haversine formula**:
   $$a = \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)$$
   $$d = 2R \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1-a}\right)$$
3. If the perpendicular projection falls outside the segment ends, calculates the geodesic distance to the closest vertex.
4. Returns the minimum distance across all perimeter edges.

### C. 3D Elevation & Floor-Level Validation
In high-rise corporate towers, a user standing on the street directly below the 14th floor has the same 2D $(lat, lng)$ coordinates. To prevent ground-level proxy check-ins:
- Each office defines `minAltitudeMeters` and `maxAltitudeMeters` (e.g. 540m to 575m).
- When mobile barometric or GPS altitude is provided, the service validates that the employee is on the physical office floor.

---

## 4. Step-by-Step Workflows ("How It Works")

### Workflow 1: Real-Time Location Verification Flow
```
Employee Mobile App             Attendance Service (3002)           Geofence Service (3003)
        │                                  │                                   │
        │ 1. Clock-in tap with GPS coords  │                                   │
        │    (lat: 18.5205, lng: 73.8565)  │                                   │
        ├─────────────────────────────────►│                                   │
        │                                  │ 2. POST /api/v1/geofence/verify   │
        │                                  │    { officeId, lat, lng }         │
        │                                  ├──────────────────────────────────►│
        │                                  │                                   │ 3. Fetch active polygon
        │                                  │                                   │ 4. Run Ray-Casting math
        │                                  │                                   │ 5. Calculate boundary dist
        │                                  │ 6. Returns:                       │
        │                                  │    { isInside: true, dist: 12m }  │
        │                                  │◄──────────────────────────────────┤
        │                                  │                                   │
        │ 7. Check-in Accepted             │                                   │
        │◄─────────────────────────────────┤                                   │
```

---

### Workflow 2: Admin Creates New Office & Polygon
1. HR or Facility Admin defines an office via `POST /api/v1/offices`.
2. Provides office details and at least 3 vertices forming a closed loop (sequence 0, 1, 2, ...).
3. The service verifies the vertices form a valid non-degenerate polygon and saves the record with `version = 1`.
4. Subsequent updates via `PUT /api/v1/offices/:id/polygon` archive the old polygon and create `version = 2`, preserving spatial audit history.

---

## 5. Database Schema & Data Models (`prisma/schema.prisma`)

```
┌────────────────────────────────────────────────────────────────────────┐
│                                offices                                 │
├────────────────────────────────────────────────────────────────────────┤
│ id: String (UUID, PK)                                                  │
│ code: String (VarChar 64, UNIQUE) e.g. "OFFICE-001"                    │
│ name: String (VarChar 128) e.g. "Pune Headquarters"                   │
│ address: String? (VarChar 255)                                         │
│ city: String? (VarChar 64)                                             │
│ country: String? (VarChar 64)                                           │
│ min_altitude_meters: Float?                                            │
│ max_altitude_meters: Float?                                            │
│ is_active: Boolean (Default: true)                                     │
│ created_at / updated_at                                                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 1
                                    │
                                    ▼ N
┌────────────────────────────────────────────────────────────────────────┐
│                           geofence_polygons                            │
├────────────────────────────────────────────────────────────────────────┤
│ id: String (UUID, PK)                                                  │
│ office_id: UUID (FK -> offices.id, Cascade)                            │
│ name: String (VarChar 128) e.g. "Main Campus Polygon"                  │
│ version: Integer (Default: 1)                                          │
│ is_active: Boolean (Default: true)                                     │
│ created_at / updated_at                                                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 1
                                    │
                                    ▼ N
┌────────────────────────────────────────────────────────────────────────┐
│                           geofence_vertices                            │
├────────────────────────────────────────────────────────────────────────┤
│ id: String (UUID, PK)                                                  │
│ polygon_id: UUID (FK -> geofence_polygons.id, Cascade)                 │
│ sequence_order: Integer (0, 1, 2, 3...)                                │
│ latitude: Decimal(10, 7)                                               │
│ longitude: Decimal(10, 7)                                              │
│ created_at: DateTime                                                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Complete REST API Reference

All routes are prefixed with `/api/v1` and accessible via the API Gateway at `http://localhost:8000/api/v1/...`.

### 1. Verify Geofence Location (Core Engine)
- **Method**: `POST /api/v1/geofence/verify`
- **Request Body**:
```json
{
  "officeId": "OFFICE-001",
  "latitude": 18.5205,
  "longitude": 73.8565,
  "altitudeMeters": 550.0
}
```
- **Response (`200 OK` - Inside Office)**:
```json
{
  "success": true,
  "data": {
    "isInside": true,
    "officeId": "d1a2b3c4-0000-0000-0000-000000000001",
    "officeCode": "OFFICE-001",
    "officeName": "Pune Headquarters",
    "distanceToBoundaryMeters": 52.72,
    "withinElevation": true
  }
}
```
- **Response (`200 OK` - Outside Office)**:
```json
{
  "success": true,
  "data": {
    "isInside": false,
    "officeId": "d1a2b3c4-0000-0000-0000-000000000001",
    "officeCode": "OFFICE-001",
    "officeName": "Pune Headquarters",
    "distanceToBoundaryMeters": 1697.10,
    "withinElevation": true
  }
}
```

---

### 2. List Offices & Active Polygons
- **Method**: `GET /api/v1/offices`
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "d1a2b3c4-0000-0000-0000-000000000001",
      "code": "OFFICE-001",
      "name": "Pune Headquarters",
      "city": "Pune",
      "country": "India",
      "isActive": true,
      "minAltitudeMeters": 500.0,
      "maxAltitudeMeters": 620.0,
      "activePolygon": {
        "id": "poly-uuid-001",
        "name": "Main Campus Polygon",
        "version": 1,
        "isActive": true,
        "vertices": [
          { "sequence": 0, "latitude": 18.5210, "longitude": 73.8560 },
          { "sequence": 1, "latitude": 18.5210, "longitude": 73.8570 },
          { "sequence": 2, "latitude": 18.5200, "longitude": 73.8570 },
          { "sequence": 3, "latitude": 18.5200, "longitude": 73.8560 }
        ]
      }
    }
  ]
}
```

---

### 3. Create New Office Location
- **Method**: `POST /api/v1/offices`
- **Request Body**:
```json
{
  "code": "OFFICE-002",
  "name": "Mumbai Branch",
  "address": "Bandra Kurla Complex, Bandra East",
  "city": "Mumbai",
  "country": "India",
  "minAltitudeMeters": 10.0,
  "maxAltitudeMeters": 80.0,
  "polygon": {
    "name": "BKC Tower A Polygon",
    "vertices": [
      { "sequence": 0, "latitude": 19.0660, "longitude": 72.8680 },
      { "sequence": 1, "latitude": 19.0660, "longitude": 72.8700 },
      { "sequence": 2, "latitude": 19.0645, "longitude": 72.8700 },
      { "sequence": 3, "latitude": 19.0645, "longitude": 72.8680 }
    ]
  }
}
```
- **Response (`201 Created`)**: Returns newly created office with initialized polygon.

---

### 4. Update Polygon for an Office
- **Method**: `PUT /api/v1/offices/:id/polygon`
- Increments polygon version and saves new vertex boundary, deactivating previous version.

---

### 5. Delete Office Geofence Polygon
- **Method**: `DELETE /api/v1/offices/:id/polygon` (or `DELETE /api/v1/geofence/:officeId`)
- **Query Params**:
  - `hard=true` *(default)*: Permanently deletes the polygon and its sequential coordinate vertices.
  - `hard=false`: Soft-deactivates the polygon (`isActive: false`).
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "officeId": "d1a2b3c4-0000-0000-0000-000000000001",
    "officeCode": "OFFICE-001",
    "deletedPolygonsCount": 1,
    "message": "Office geofence polygon(s) deleted successfully"
  },
  "message": "Office geofence polygon deleted successfully"
}
```

---

### 6. Delete Individual Polygon by Polygon ID
- **Method**: `DELETE /api/v1/geofence/polygons/:polygonId`
- Removes the specific polygon record and its coordinate vertices.

---

### 7. Delete Office and Cascade All Associated Geofence Data
- **Method**: `DELETE /api/v1/offices/:id`
- **Query Params**: `hard=true` (permanent) or `hard=false` (deactivates office and polygons).
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "officeId": "d1a2b3c4-0000-0000-0000-000000000001",
    "officeCode": "OFFICE-001",
    "message": "Office and all associated geofence data deleted successfully"
  },
  "message": "Office deleted successfully"
}
```

---

## 7. Environment Configuration Reference (`.env`)

| Variable | Description | Recommended / Example Value |
|---|---|---|
| `PORT` | Local HTTP port | `3003` |
| `DATABASE_URL` | MySQL connection string (sanitized) | `mysql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:3306/geofence_db` |
| `GATEWAY_SHARED_SECRET` | Secret for HMAC signature and gateway header | `your-internal-gateway-shared-secret` |
| `GEOFENCE_DEV_AUTH` | When `true`, allows standalone testing without HMAC | `false` |

---

## 8. Local Setup & Testing

```bash
# 1. Install dependencies
cd backend/geofence-service
npm install

# 2. Run Prisma migrations
npm run prisma:generate
npm run prisma:migrate:dev --name init

# 3. Seed default Pune HQ office and quadrilateral polygon
npm run prisma:seed

# 4. Start service in watch mode
npm run start:dev

# 5. Run unit tests (Ray-casting and Haversine math suites)
npm run test
```
