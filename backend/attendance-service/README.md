# Attendance Service

The attendance business-logic microservice for the Smart Employee Attendance & Management System.
It owns the attendance state machine, working-time calculation, geofence-driven pause/resume,
grace-period auto-checkout, and offline sync — nothing else.

## 1. What this service does

Given an authenticated employee and validated location/business inputs, this service answers:
*"what is the correct attendance state, and what attendance event should be recorded?"*

It does **not** decide who the employee is, whether they're allowed at a given office, whether
their face is valid, or how office polygons are managed — those are other services' jobs (see §2).

## 2. Architecture

```
                 ┌─────────────────┐
 Mobile / Admin  │   API Gateway    │  (not built here — dev-auth headers stand in for it)
                 └────────┬─────────┘
                          │ trusted employeeId/userId/roles headers
                 ┌────────▼─────────┐
                 │ Attendance Svc   │  ← this repo
                 │                  │
                 │  AttendanceService (state machine, all business rules)
                 │       │    │    │
                 │  Geofence Employee Policy   ← interfaces, mocked for V1
                 │  Provider Provider Provider
                 └────────┬─────────┘
                          │
                    MySQL (Prisma) — attendance_sessions, attendance_pauses,
                                     attendance_events, employee_attendance_locks
```

This service owns only attendance tables. It does **not** create a users/employees/offices
table, and does **not** put a foreign key on tables owned by another service — `employeeId`
and `officeId` are stored as opaque external string references.

Three interfaces mark the integration boundaries, each with a permissive mock implementation
for V1 so the service is fully testable standalone:

| Interface | Real owner (future) | V1 mock behavior |
|---|---|---|
| `GeofenceProvider` (`src/geofence`) | Geofence Service | In-memory polygon registry, ray-casting point-in-polygon check. Unknown office ids fail closed. |
| `EmployeeProvider` (`src/employee`) | Employee Service | Permissive — every employee is assigned to every office unless explicitly denied via a test helper. |
| `AttendancePolicyProvider` (`src/policy`) | Possibly an HR/org-settings service | Single global policy read from environment config. |

## 3. Prerequisites

- Node.js 20+
- MySQL 8+ (or use the provided `docker-compose.yml`)
- npm

## 4. Environment variables

Copy `.env.example` to `.env` and fill in real values. Key groups:

- **App**: `PORT`, `API_PREFIX` (`api/v1`), `SWAGGER_PATH` (`api/docs`), `CORS_ORIGINS`
- **Database**: `DATABASE_URL` (MySQL connection string)
- **Auth** (§17 below): `ATTENDANCE_DEV_AUTH`, `DEV_DEFAULT_EMPLOYEE_ID`, `GATEWAY_*`
- **Policy** (§14): `POLICY_CHECK_IN_START_TIME`, `POLICY_CHECK_IN_END_TIME`,
  `POLICY_LATE_THRESHOLD_MINUTES`, `POLICY_GRACE_PERIOD_MINUTES`,
  `POLICY_AUTO_CHECKOUT_ENABLED`, `POLICY_WORKING_HOURS_PER_DAY`,
  `POLICY_ALLOW_MANUAL_CHECKOUT_WHILE_PAUSED`, `POLICY_MIN_LOCATION_ACCURACY_METERS`
- **Scheduler**: `AUTO_CHECKOUT_CRON` (default every minute), `AUTO_CHECKOUT_BATCH_SIZE`
- **Redis** (optional, unused by the core flow): `REDIS_ENABLED`, `REDIS_URL`

## 5. MySQL setup

```bash
mysql -u root -p -e "CREATE DATABASE attendance_service; CREATE USER 'attendance_user'@'%' IDENTIFIED BY 'attendance_password'; GRANT ALL ON attendance_service.* TO 'attendance_user'@'%';"
```

Or use Docker (see §9).

## 6. Prisma setup

```bash
npm install
npx prisma generate
```

## 7. Migrations

```bash
npx prisma migrate dev --name init
```

## 8. Running locally

```bash
npm run start:dev
```

Service listens on `http://localhost:3002` by default. Health check is unprefixed
(`GET /health`); everything else is under `/api/v1`.

## 9. Docker setup

```bash
cp .env.example .env
docker compose up --build
```

Brings up the service + MySQL (+ optional Redis, unused). Run migrations against the
container the first time:

```bash
docker compose exec attendance-service npx prisma migrate deploy
```

## 10. Swagger

`http://localhost:3002/api/docs` — documents every endpoint, DTO, and enum.

## 11. API endpoints

All under `/api/v1` except `/health`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/attendance/check-in` | Start a new attendance session |
| POST | `/attendance/check-out` | Manually end the active session |
| POST | `/attendance/geofence-exit` | Record leaving the office boundary → PAUSED |
| POST | `/attendance/geofence-return` | Record returning to the office boundary → WORKING |
| POST | `/attendance/sync` | Submit a batch of offline-queued events |
| GET | `/attendance/today` | Today's session(s) + total working time |
| GET | `/attendance/history?startDate=&endDate=&page=&limit=` | Paginated history |
| GET | `/attendance/:sessionId` | One session (only if it belongs to the caller) |
| GET | `/health` | Liveness + DB connectivity |

### Response envelope

```json
// success
{ "success": true, "data": { ... }, "message": "Attendance checked in successfully" }
// error
{ "success": false, "error": { "code": "ATTENDANCE_ALREADY_ACTIVE", "message": "..." } }
```

### Example curl requests

```bash
# Check in (dev auth: X-Employee-Id header selects the employee)
curl -X POST http://localhost:3002/api/v1/attendance/check-in \
  -H "Content-Type: application/json" \
  -H "X-Employee-Id: EMP-001" \
  -d '{
    "officeId": "OFFICE-001",
    "location": { "latitude": 18.5204, "longitude": 73.8567, "accuracyMeters": 10, "timestamp": "2026-09-22T09:32:10Z" },
    "clientEventId": "c1a2b3c4-0000-0000-0000-000000000001"
  }'

# Geofence exit
curl -X POST http://localhost:3002/api/v1/attendance/geofence-exit \
  -H "Content-Type: application/json" -H "X-Employee-Id: EMP-001" \
  -d '{
    "officeId": "OFFICE-001",
    "location": { "latitude": 18.5300, "longitude": 73.8700, "timestamp": "2026-09-22T12:00:00Z" },
    "clientEventId": "c1a2b3c4-0000-0000-0000-000000000002"
  }'

# Today
curl http://localhost:3002/api/v1/attendance/today -H "X-Employee-Id: EMP-001"

# History
curl "http://localhost:3002/api/v1/attendance/history?startDate=2026-09-01&endDate=2026-09-22&page=1&limit=20" \
  -H "X-Employee-Id: EMP-001"
```

## 12. Attendance state machine

```
NOT_CHECKED_IN --CHECK_IN--> WORKING --GEOFENCE_EXIT--> PAUSED
                                 ^                         |  \
                                 |______GEOFENCE_RETURN____|   \_GRACE_TIMEOUT (auto)
                                 |                                    |
                                 |___________________CHECK_OUT________v
                                                                  CHECKED_OUT (terminal)
```

- `WORKING` and `PAUSED` are the only **active** states; an employee can never have two
  active sessions at once (enforced in application logic — see the concurrency note below).
- `CHECKED_OUT` is terminal and is **never reopened**. A same-day re-check-in creates a
  **new** session and currently requires an HR-authorized exception that **does not exist
  yet** in V1 — see the TODO in §16.
- Working duration is always derived from `checkInAt` / `checkOutAt` / pause timestamps
  (`WorkingTimeService.calculateWorkingSeconds`), never a per-second counter.

## 13. Geofence provider integration

`GeofenceProvider.isInsideOffice(officeId, lat, lng)` is the only way this service asks
"is this point inside that office?" `MockGeofenceProvider` holds polygons in memory (seeded
with the spec's example polygon under office id `OFFICE-001`) and does a ray-casting
point-in-polygon test — accurate enough for office-sized areas, not for very large regions.

To integrate the real Geofence Service later: implement `GeofenceProvider` with an
HTTP/gRPC client, and swap the binding in `src/geofence/geofence.module.ts`. Nothing else
in the codebase changes. If polygon data ever needs to live in *this* service's own
database for performance, MySQL 8's spatial functions (`ST_Contains`/`ST_Within` on a
`POLYGON` column) are the natural replacement for the in-process ray-casting check — see
the comment in `point-in-polygon.util.ts`.

## 14. Offline synchronization

`POST /attendance/sync` accepts a batch of events with client-assigned timestamps and
`clientEventId`s. The server is authoritative: each event is replayed through the *same*
state-machine methods used by the online endpoints (`checkIn`/`checkOut`/`geofenceExit`/
`geofenceReturn`), using the event's own `eventTime` as the effective timestamp instead of
"now". Events are processed **sequentially**, not in parallel, to preserve per-employee
ordering (an exit must apply before its matching return).

Each event resolves to one of:
- `PROCESSED` — applied successfully
- `ALREADY_PROCESSED` — this `clientEventId` was already applied (idempotent replay)
- `INVALID_STATE` — rejected because the state machine says no (e.g. already active,
  no active session, checkout-while-paused not allowed)
- `REJECTED` — rejected for another reason (validation, outside geofence, not assigned
  to office, etc.)

One bad event in a batch never aborts the rest of the batch.

## 15. Testing

```bash
npm run test        # unit tests
npm run test:e2e     # e2e tests (HTTP stack against an in-memory fake Prisma — no DB required)
npm run test:cov     # coverage
```

### What's covered by automated tests
- `WorkingTimeService`: WORKING/PAUSED/CHECKED_OUT duration calculation, multiple pauses,
  the spec's 7.5h worked-example, negative-duration clamping.
- `isPointInPolygon`: inside/outside/degenerate-polygon cases.
- `AttendanceService` (via `FakePrismaService`, an in-memory Prisma double — see
  `src/testing/fake-prisma.testutil.ts`): check-in, duplicate check-in, idempotent replay
  of the same `clientEventId`, reusing a `clientEventId` for a different event type,
  employee-not-assigned / outside-geofence rejections, re-check-in-after-completion
  rejection, checkout with no active session, checkout-while-paused rejection, geofence
  exit/return including grace-deadline computation, the auto-checkout sweep (including
  "safe if run twice" and "disabled by policy"), offline sync with a mixed batch, **and
  the full acceptance scenario from the spec (§37) end to end, including the exact
  expected event sequence**.
- e2e: the real HTTP stack (guard → validation pipe → controller → service → response
  envelope / error filter) against the same fake Prisma double.

### What's intentionally NOT covered by the Jest suite, and why
`FakePrismaService` runs everything sequentially in-process — it does **not** simulate
real database row-locking, so it cannot prove two truly simultaneous requests are
serialized correctly. That requires a real MySQL instance. `scripts/concurrent-checkin-test.ts`
is a standalone script (not part of `npm test`) that fires genuinely concurrent HTTP
requests at a **running instance with a real database** and asserts exactly one succeeds:

```bash
docker compose up -d mysql && npx prisma migrate deploy && npm run start:dev
# in another terminal:
npx ts-node scripts/concurrent-checkin-test.ts
```

## 16. Future integration with other services — assumptions & TODOs

- **Auth Service / API Gateway**: this service never authenticates anyone itself. See §17
  below. In production (`ATTENDANCE_DEV_AUTH=false`), it trusts `X-Employee-Id`/`X-User-Id`/
  `X-Roles` headers **only** alongside a shared-secret header (`GATEWAY_SHARED_SECRET`) —
  a stopgap until the Gateway does real service-to-service auth (mTLS or similar).
- **Employee Service**: `EmployeeProvider` needs a real implementation once it exists.
  V1's mock is permissive by default.
- **Geofence Service**: see §13.
- **HR-authorized re-check-in exception**: `AttendanceSession.reopenReason` /
  `reopenAuthorizedBy` columns and the `ATTENDANCE_REJECTED` event type exist in the
  schema/enum but there's **no approval workflow yet** — a same-day re-check-in after a
  completed session is always rejected in V1. Wiring this up (likely an HR-service
  endpoint that grants a one-time exception token this service can verify) is a TODO.
- **Face AI Service**: entirely out of scope here; this service assumes identity is
  already verified before a request reaches it.
- **Notification Service**: not integrated. A natural V2 hook is publishing a lightweight
  event (or calling a Notification Service endpoint) on `AUTO_CHECKOUT` and
  `ATTENDANCE_REJECTED`, so an employee/HR gets notified without polling.
- **Reporting & Audit Service**: `attendance_events` is already an append-only, immutable
  log suitable for a reporting service to read from directly or via CDC — no schema change
  needed to support that later.

## 17. Authentication integration (dev vs production)

This service never runs its own login system. `EmployeeAuthGuard` (`src/common/guards`)
resolves identity one of two ways, controlled by `ATTENDANCE_DEV_AUTH`:

- **`ATTENDANCE_DEV_AUTH=true`** (default): trusts `X-Employee-Id` / `X-User-Id` / `X-Roles`
  headers verbatim, with **no verification** — falls back to `DEV_DEFAULT_EMPLOYEE_ID` if
  omitted. Logs a loud warning on first use. **Never enable this outside local development.**
- **`ATTENDANCE_DEV_AUTH=false`**: requires the same identity headers **plus** a shared
  secret header (`GATEWAY_SHARED_SECRET_HEADER` / `GATEWAY_SHARED_SECRET`) that only the
  API Gateway should know, so a direct caller can't simply forge `X-Employee-Id`. Treat
  `GATEWAY_SHARED_SECRET` as a real secret in any shared environment.

## Design decisions & documented assumptions

Per the spec's own instruction to "prefer the simplest production-appropriate V1 design and
document the assumption rather than stopping unnecessarily":

- **The spec contradicts itself on `UNIQUE(employeeId, attendanceDate)`**: §3 explicitly
  *forbids* that constraint (multiple sessions per day must be allowed), while §19
  *recommends* it. This implementation follows §3 (the business-rule-driven instruction)
  and uses a regular composite index instead of a unique one. Worth flagging to whoever
  wrote the spec.
- **Concurrency control without a unique-active-session constraint**: MySQL has no native
  partial/filtered unique index (unlike Postgres), so "only one active session per
  employee" can't be expressed as a single DB constraint given the point above. Instead,
  `EmployeeAttendanceLock` + `SELECT ... FOR UPDATE` serializes concurrent check-in
  attempts *per employee* inside a transaction, and every state-transition write uses a
  conditional `updateMany` (`WHERE id = ? AND status = ?`) with a `count` check, so a lost
  race is detected and rejected rather than silently overwritten.
- **Calendar day = server UTC date**, not a per-office timezone. Fine for a single-timezone
  deployment; a multi-timezone rollout should make `AttendancePolicyProvider` timezone-aware
  per office before this matters.
- **Check-in status window**: `ON_TIME`/`LATE`/`EXCEPTION` are derived from a single global
  `checkInStartTime`/`checkInEndTime`/`lateThresholdMinutes` policy, not a per-employee
  shift schedule (which doesn't exist yet — that's Employee/HR service territory).
- **Manual checkout while PAUSED**, when explicitly allowed by policy
  (`POLICY_ALLOW_MANUAL_CHECKOUT_WHILE_PAUSED=true`), closes the open pause with
  `endReason: RETURNED` — the spec's `PauseEndReason` enum only has `RETURNED`/
  `AUTO_CHECKOUT`, with no third option for "force-closed by manual checkout while paused".
- **History default window**: if `startDate`/`endDate` aren't supplied, defaults to the
  last 30 days ending today (not specified in the spec).
- **Admin/HR read access** to other employees' attendance is not implemented in V1 (spec
  §17 says it "can be added later") — every query is scoped strictly to the caller's own
  `employeeId`.
