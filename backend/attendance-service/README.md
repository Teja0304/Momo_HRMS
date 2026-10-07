# Attendance Microservice (`attendance-service`)

> **Momo HRMS — Core Attendance State Machine, Working Time Engine & Biometric Geofence Enforcement**  
> Manages the entire employee attendance lifecycle: state machine transitions, strict multi-point polygon geofencing, mandatory Face AI verification, mock GPS spoof rejection, working time calculations, grace-period auto-checkout, and offline event synchronization.

---

## 1. Executive Summary & Core Purpose

The **Attendance Service** is the central operational engine of the **Smart Employee Attendance & Management System (Momo HRMS)**.

Given an authenticated employee attempting to check in or record an attendance event, this service answers:
> *"Is this employee authorized to record attendance right now, is their location genuine and inside the verified office polygon, is their face biometrically verified with active liveness, and what is the exact state transition and working duration?"*

It acts as the authoritative governor of attendance truth without storing user passwords, organizational hierarchies, or facial vectors.

---

## 2. Microservice Architecture & System Topology

```
                                  ┌────────────────────────┐
                                  │   React Web / Mobile   │
                                  └───────────┬────────────┘
                                              │
                                              ▼
                                    API GATEWAY (Port 8000)
                                 (Rate Limited & HMAC Signed)
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
                    ▼                         ▼                         ▼
             Employee Service         Geofence Service          Face AI Service
               (Port 3004)              (Port 3003)               (Port 3006)
                    │                         │                         │
            "Assigned to Office?"     "Inside Polygon?"        "Face Token Valid?"
                    │                         │                         │
                    └────────────────────────►├◄────────────────────────┘
                                              │
                                     ┌────────▼─────────┐
                                     │Attendance Service│
                                     │   (Port 3002)    │
                                     └────────┬─────────┘
                                              │
                                              ▼
                                    MySQL (attendance_db)
                         - attendance_sessions
                         - attendance_pauses
                         - attendance_events
                         - employee_attendance_locks
```

### Domain Boundary & Separation of Concerns:
- **What This Service OWNS**: Attendance sessions (`WORKING`, `PAUSED`, `CHECKED_OUT`), pauses and interruptions, immutable event audit logs (`attendance_events`), concurrency row locks, and working duration calculations.
- **What This Service DOES NOT OWN**:
  - User login, password hashing, and JWT tokens (owned by `auth-service`).
  - Employee names, job titles, and office assignment contracts (owned by `employee-service`).
  - Office polygon coordinates and Ray-Casting math (owned by `geofence-service`).
  - Biometric face vector encryption and liveness challenges (owned by `face-ai-service`).
  - In-app notification delivery and SSE streaming (owned by `notification-service`).

---

## 3. What is Implemented in This Microservice

### A. The Attendance State Machine
Every employee's attendance follows a deterministic finite-state automaton:

```
[ NOT_CHECKED_IN ]
        │
        │  CHECK_IN (Requires valid face token & inside office polygon)
        ▼
   [ WORKING ] ◄─────────────────┐
        │                        │
        │ GEOFENCE_EXIT          │ GEOFENCE_RETURN (Within grace period)
        ▼                        │
    [ PAUSED ] ──────────────────┘
        │
        │──► GRACE_PERIOD_TIMEOUT (Auto-checkout cron job) ──┐
        │                                                    ▼
        └────────────────── CHECK_OUT ────────────────► [ CHECKED_OUT ] (Terminal)
```

1. **`NOT_CHECKED_IN`**: Default state at the start of the day.
2. **`WORKING`**: The employee is actively present on site. Working time increments continuously.
3. **`PAUSED`**: The employee has exited the office polygon (e.g. for lunch or personal errand). Working time accumulation is paused. A grace deadline (e.g., 60 minutes) is calculated and assigned.
4. **`CHECKED_OUT`**: Terminal state for the session. Once checked out, the session is immutable and cannot be reopened.

### B. Mandatory Face AI Verification (`faceVerificationToken`)
To eliminate buddy punching and proxy check-ins, **face verification is mandatory for every check-in**:
- The client must first complete an active challenge-response liveness session with the **Face AI Service** (`/api/v1/face/verify`).
- Upon success, the Face AI Service issues a short-lived, cryptographically signed `faceVerificationToken` (valid for 5 minutes).
- The Attendance Service validates this token before transitioning to `WORKING`. If the token is missing, expired, or tampered with, the check-in is rejected (`400 FACE_VERIFICATION_REQUIRED`).

### C. Mock GPS / Fake Location Shield
Android and iOS allow "Mock Location" apps (fake GPS joysticks). The mobile client inspects hardware-level flags (`location.mocked` / `isFromMockProvider`):
- If `location.isMocked === true`, the Attendance Service **immediately terminates the check-in attempt**.
- Logs a security alert and rejects the request with `400 MOCK_LOCATION_DETECTED`.

### D. Multi-Point Polygon Geofence Validation
- Validates the employee's GPS coordinates $(lat, lng)$ against the official boundary of the office branch via `GeofenceService`.
- Point-radius circular geofencing is prohibited. Only complex $N$-sided polygons ($\ge 3$ vertices) are supported.
- If the employee is outside the boundary, check-in is rejected (`400 GEOFENCE_VIOLATION`) with the exact distance in meters to the nearest office boundary edge.

### E. Concurrency Protection & Row-Level Locking
To prevent double check-in race conditions (e.g., an employee double-tapping the button on a slow network or firing simultaneous requests from two phones):
- An explicit locking table (`employee_attendance_locks`) is used.
- Inside an atomic Prisma transaction, a `SELECT ... FOR UPDATE` lock is acquired on the employee's lock record.
- Every state transition write uses conditional `updateMany({ where: { id, status: expectedStatus } })` with a count check. If another worker thread modified the state in the microsecond interval, the race is safely rejected (`409 ATTENDANCE_ALREADY_ACTIVE`).

### F. Pure Derived Working Duration Engine (`WorkingTimeService`)
Unlike naive attendance systems that run tick counters every second:
- Working time is **mathematically derived** from timestamps:
  $$\text{Working Seconds} = (\text{checkOutAt} - \text{checkInAt}) - \sum \text{Pause Durations}$$
- Eliminates clock drift, database load, and synchronization errors.
- Handles multiple pauses cleanly and prevents negative durations.

### G. Automatic Grace-Period Auto-Checkout (`AutoCheckoutJob`)
- A NestJS scheduled cron job runs periodically (e.g. every minute).
- Sweeps all sessions currently in the `PAUSED` state where `graceDeadlineAt < NOW()`.
- Automatically terminates the session with `checkOutStatus: AUTO_CHECKOUT` and records an immutable `AUTO_CHECKOUT` audit event.

### H. Authoritative Offline Synchronization (`POST /attendance/sync`)
For field sites or basement parking with intermittent connectivity:
- The mobile app queues events locally with UUIDs (`clientEventId`) and capture timestamps.
- When reconnected, the client submits the queue to `/api/v1/attendance/sync`.
- The server processes events **sequentially** per employee (ensuring an exit is evaluated before a return).
- Replays each event through the identical state machine rules using the historical timestamp.
- **Idempotent**: Re-submitting the same `clientEventId` safely returns `ALREADY_PROCESSED` without double-recording.

---

## 4. Step-by-Step Workflows ("How It Works")

### Workflow 1: The Secure Check-In Flow
```
Mobile App                  Face AI Service (3006)         Geofence Service (3003)       Attendance Service (3002)
    │                                │                                │                              │
    │ 1. Complete Active Liveness    │                                │                              │
    │    (Blink / Smile challenge)   │                                │                              │
    ├───────────────────────────────►│                                │                              │
    │ 2. Issues Face Token (5m exp)  │                                │                              │
    │◄───────────────────────────────┤                                │                              │
    │                                                                 │                              │
    │ 3. Check-In Request                                             │                              │
    │    { officeId, location: { lat, lng, isMocked: false },         │                              │
    │      faceVerificationToken }                                    │                              │
    ├─────────────────────────────────────────────────────────────────┼─────────────────────────────►│
    │                                                                 │                              │
    │                                                                 │  4. Verify Geofence Polygon  │
    │                                                                 │◄─────────────────────────────┤
    │                                                                 │  5. Returns { isInside: true }
    │                                                                 ├─────────────────────────────►│
    │                                                                 │                              │
    │                                                                 │  6. Validate Face Token      │
    │                                                                 │  7. Acquire DB Row Lock      │
    │                                                                 │  8. Record WORKING Session   │
    │                                                                 │  9. Write Immutable Audit Log│
    │ 10. 201 Created (Attendance Session Active)                     │                              │
    │◄────────────────────────────────────────────────────────────────┴──────────────────────────────┤
```

---

### Workflow 2: Geofence Exit, Grace Period, and Return
1. **Exit**: The employee steps out of the office. The background geofence monitor triggers `POST /api/v1/attendance/geofence-exit`.
2. The session transitions from `WORKING` to `PAUSED`.
3. A pause record is opened with `pauseStartAt = NOW()`, and `graceDeadlineAt` is set to `NOW() + POLICY_GRACE_PERIOD_MINUTES` (e.g. 60 minutes).
4. **Case A (Return on time)**: The employee returns within 45 minutes and calls `POST /api/v1/attendance/geofence-return`. The pause record is closed with `endReason: RETURNED`, and session transitions back to `WORKING`.
5. **Case B (Grace period expires)**: The employee does not return. At minute 61, the `AutoCheckoutJob` sweep detects `graceDeadlineAt < NOW()`, auto-checks out the session, and triggers a notification.

---

## 5. Database Schema & Data Models (`prisma/schema.prisma`)

```
┌────────────────────────────────────────────────────────────────────────┐
│                          attendance_sessions                           │
├────────────────────────────────────────────────────────────────────────┤
│ id: String (UUID, PK)                                                  │
│ employee_id: String (Opaque reference to employee-service)             │
│ office_id: String (Opaque reference to geofence-service)               │
│ session_date: Date                                                     │
│ status: ENUM ('WORKING', 'PAUSED', 'CHECKED_OUT')                      │
│ check_in_status: ENUM ('ON_TIME', 'LATE', 'EXCEPTION')                 │
│ check_in_at: DateTime                                                  │
│ check_out_at: DateTime?                                                │
│ check_out_status: ENUM ('NORMAL', 'AUTO_CHECKOUT', 'EARLY_DEPARTURE')? │
│ total_working_seconds: Integer (Default: 0)                            │
│ total_pause_seconds: Integer (Default: 0)                              │
│ current_pause_id: String?                                              │
│ grace_deadline_at: DateTime?                                           │
│ created_at / updated_at                                                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 1
                 ┌──────────────────┴──────────────────┐
                 │ 1                                   │ 1
                 ▼ N                                   ▼ N
┌───────────────────────────────────┐ ┌──────────────────────────────────┐
│         attendance_pauses         │ │        attendance_events         │
├───────────────────────────────────┤ ├──────────────────────────────────┤
│ id: String (UUID, PK)             │ │ id: String (UUID, PK)            │
│ session_id: UUID (FK)             │ │ session_id: UUID (FK)            │
│ employee_id: String               │ │ employee_id: String              │
│ pause_start_at: DateTime          │ │ event_type: ENUM ('CHECK_IN',   │
│ pause_end_at: DateTime?           │ │   'CHECK_OUT', 'GEOFENCE_EXIT',  │
│ pause_duration_seconds: Integer?  │ │   'GEOFENCE_RETURN',             │
│ end_reason: ENUM ('RETURNED',     │ │   'AUTO_CHECKOUT')               │
│   'AUTO_CHECKOUT')                │ │ event_time: DateTime             │
│ created_at / updated_at           │ │ latitude: Decimal(10, 7)         │
└───────────────────────────────────┘ │ longitude: Decimal(10, 7)        │
                                      │ accuracy_meters: Float           │
┌───────────────────────────────────┐ │ is_mocked: Boolean               │
│     employee_attendance_locks     │ │ client_event_id: String UNIQUE   │
├───────────────────────────────────┤ │ raw_payload: JSON?               │
│ employee_id: String (PK)          │ │ created_at: DateTime             │
│ locked_at: DateTime               │ └──────────────────────────────────┘
└───────────────────────────────────┘
```

---

## 6. Complete REST API Reference

All endpoints are prefixed with `/api/v1` and accessible via the API Gateway at `http://localhost:8000/api/v1/...`.

### 1. Clock In (`POST /api/v1/attendance/check-in`)
- **Headers**:
  - `x-employee-id: EMP-001` (Injected automatically by API Gateway from JWT claims).
- **Request Body**:
```json
{
  "officeId": "OFFICE-001",
  "location": {
    "latitude": 18.5204,
    "longitude": 73.8567,
    "accuracyMeters": 10.5,
    "isMocked": false,
    "timestamp": "2026-09-29T09:00:00.000Z"
  },
  "faceVerificationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "clientEventId": "c1a2b3c4-0000-0000-0000-000000000001"
}
```
- **Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "sessionId": "s1a2b3c4-0000-0000-0000-000000000001",
    "employeeId": "EMP-001",
    "officeId": "OFFICE-001",
    "status": "WORKING",
    "checkInAt": "2026-09-29T09:00:00.000Z",
    "checkInStatus": "ON_TIME",
    "totalWorkingSeconds": 0
  },
  "message": "Attendance checked in successfully"
}
```

---

### 2. Clock Out (`POST /api/v1/attendance/check-out`)
- **Request Body**:
```json
{
  "location": {
    "latitude": 18.5204,
    "longitude": 73.8567,
    "accuracyMeters": 12.0,
    "isMocked": false,
    "timestamp": "2026-09-29T17:30:00.000Z"
  },
  "clientEventId": "c1a2b3c4-0000-0000-0000-000000000002"
}
```
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "sessionId": "s1a2b3c4-0000-0000-0000-000000000001",
    "status": "CHECKED_OUT",
    "checkOutAt": "2026-09-29T17:30:00.000Z",
    "checkOutStatus": "NORMAL",
    "totalWorkingSeconds": 30600
  },
  "message": "Checked out successfully"
}
```

---

### 3. Geofence Exit (`POST /api/v1/attendance/geofence-exit`)
- **Purpose**: Called when the employee leaves the building polygon during work hours.
- **Response (`200 OK`)**: Sets state to `PAUSED`, opens pause record, and returns `graceDeadlineAt`.

---

### 4. Geofence Return (`POST /api/v1/attendance/geofence-return`)
- **Purpose**: Called when the employee re-enters the polygon.
- **Response (`200 OK`)**: Closes pause record, sets state to `WORKING`, and accumulates paused duration.

---

### 5. Offline Event Synchronization (`POST /api/v1/attendance/sync`)
- **Request Body**:
```json
{
  "events": [
    {
      "clientEventId": "offline-uuid-001",
      "eventType": "CHECK_IN",
      "officeId": "OFFICE-001",
      "eventTime": "2026-09-29T09:05:00.000Z",
      "location": { "latitude": 18.5204, "longitude": 73.8567, "isMocked": false },
      "faceVerificationToken": "..."
    }
  ]
}
```
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "total": 1,
    "processed": 1,
    "results": [
      {
        "clientEventId": "offline-uuid-001",
        "status": "PROCESSED"
      }
    ]
  }
}
```

---

### 6. Get Today's Attendance (`GET /api/v1/attendance/today`)
- Returns the caller's active session, check-in time, current pauses, and calculated working duration for the day.

---

### 7. Attendance History (`GET /api/v1/attendance/history`)
- **Query Parameters**: `startDate`, `endDate`, `page`, `limit`.
- Returns paginated attendance sessions with complete working time metrics.

---

## 7. Environment Configuration Reference (`.env`)

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | Local HTTP port for the attendance service | `3002` |
| `DATABASE_URL` | MySQL connection string (sanitized) | `mysql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:3306/attendance_service` |
| `GATEWAY_SHARED_SECRET` | Secret for HMAC signature and gateway header | `your-internal-gateway-shared-secret` |
| `POLICY_CHECK_IN_START_TIME` | Expected start of shift (HH:mm) | `09:00` |
| `POLICY_LATE_THRESHOLD_MINUTES` | Minutes after start before marked `LATE` | `15` |
| `POLICY_GRACE_PERIOD_MINUTES` | Max duration allowed outside geofence before auto-checkout | `60` |
| `POLICY_AUTO_CHECKOUT_ENABLED` | Enables the automatic grace period timeout sweep | `true` |
| `AUTO_CHECKOUT_CRON` | Cron schedule for the auto-checkout sweeper | `*/1 * * * *` (every min) |
| `ATTENDANCE_DEV_AUTH` | When `true`, uses dev identity headers without HMAC | `false` |

---

## 8. Local Setup & Verification

```bash
# 1. Install dependencies
cd backend/attendance-service
npm install

# 2. Run Prisma migrations
npm run prisma:generate
npm run prisma:migrate:dev

# 3. Start in watch mode
npm run start:dev

# 4. Run automated unit & state machine tests
npm run test
```
