# Momo HRMS — Employee Management Service

A standalone backend service (Node.js + Express 5 + TypeScript + MySQL 8 + Prisma) that manages
employees, departments, roles, devices and face-template references for the Momo HRMS Admin
portal. It reuses the JWTs issued by the existing `backend/auth-service` — it does **not**
duplicate login or signup.

- Base URL: `http://localhost:5000/api/v1`
- Swagger UI: `http://localhost:5000/api-docs`
- Health check: `http://localhost:5000/health`

## 1. How this fits with the rest of the repo

```
Momo-HRMS/
  backend/
    auth-service/        <- existing login module (NestJS). Issues JWTs. Untouched.
    employee-service/     <- THIS service (Express). Verifies the SAME JWTs.
  frontend/
    mobile/ (Expo)
    web/ (Vite + React)
```

`employee-service` verifies access tokens with the exact same `JWT_ACCESS_SECRET` as
`auth-service`, so a user who logs in through the existing login screen can call this service's
APIs with the token they already have — no second login.

Employees are **not** login accounts. An `Employee` row optionally links to an existing
`auth-service` user via `employees.user_id` (a plain column, not a foreign key, because the two
services use separate databases). Creating an employee does not create a login account, and vice
versa.

### About roles — read this before you seed or test

The **JWT roles** used for permissions (`EMPLOYEE`, `HR_ADMIN`, `SUPER_ADMIN`) come from
`auth-service` and are checked directly from the verified token — this service never invents a
second permission system. The **`Role` table** in this service (`SUPER_ADMIN`, `HR_ADMIN`,
`MANAGER`, `EMPLOYEE`) is a separate, HR-only concept: an employee's job-level/organisational
role, shown on their profile and used for org-chart-style queries (`GET /roles/:id/employees`).
`MANAGER` exists only in this table — it is not, and does not need to be, a login permission.
Changing an employee's `Role` (`PATCH /employees/:id/role`) *also* pushes the matching login role
to `auth-service`, but only when the name matches one auth-service recognises (`EMPLOYEE`,
`HR_ADMIN`, `SUPER_ADMIN`) and `AUTH_SERVICE_URL` is configured; syncing a `MANAGER` employee's
login roles is a no-op today (see the Known Limitations section).

## 2. Prerequisites (Windows + VS Code)

1. **Node.js 20+** — check with `node -v` and `npm -v` in a terminal (PowerShell or Command
   Prompt). If missing, install the LTS version from nodejs.org.
2. **MySQL 8** — install "MySQL Server 8.0" via MySQL Installer for Windows
   (dev.mysql.com/downloads/installer). During setup, set a root password you'll remember and
   leave the default port `3306`.
3. **VS Code** with any REST/Prisma extensions you like (optional).
4. **Postman** (desktop app or web) for API testing.

## 3. Start MySQL and create the database

1. Open **Services** (Win+R → `services.msc`) and confirm **MySQL80** is *Running*. If not,
   right-click → Start.
2. Open a terminal and connect as root:
   ```
   mysql -u root -p
   ```
3. Create the database and a dedicated user (replace the password):
   ```sql
   CREATE DATABASE momo_hrms DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'momo'@'localhost' IDENTIFIED BY 'momoPass123!';
   GRANT ALL PRIVILEGES ON momo_hrms.* TO 'momo'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

## 4. Get the code running

Open **`backend/employee-service`** as the folder in VS Code, then use its integrated terminal
(``Ctrl+` ``) for every command below — all commands run from this folder unless stated otherwise.

1. **Install dependencies**
   ```
   npm install
   ```
2. **Create your `.env`**
   ```
   copy .env.example .env
   ```
   Open `.env` and fill in:
   - `DATABASE_URL="mysql://momo:momoPass123!@localhost:3306/momo_hrms"` (match what you created
     in step 3)
   - `JWT_ACCESS_SECRET` — **must be the exact same value** as `JWT_ACCESS_SECRET` in
     `backend/auth-service/.env`. Generate a pair of secrets with:
     ```
     node scripts/generate-secrets.js
     ```
     Paste `JWT_ACCESS_SECRET` into **both** `.env` files (auth-service and employee-service).
     Paste `INTERNAL_SERVICE_API_KEY` into employee-service's `.env` only — this is the key the
     attendance service will send back.
   - `AUTH_SERVICE_URL=http://localhost:3001/api/v1` if `auth-service` is running (optional — see
     Known Limitations). Leave it blank to run employee-service completely standalone.
3. **Generate the Prisma Client**
   ```
   npm run prisma:generate
   ```
4. **Run the migration** (creates all tables)
   ```
   npm run prisma:migrate:deploy
   ```
   If your machine cannot reach `binaries.prisma.sh` (some locked-down networks block it), Prisma
   CLI itself won't run. As a fallback, apply the SQL directly:
   ```
   mysql -u momo -p momo_hrms < prisma/migrations/20260921120000_init/migration.sql
   ```
5. **Seed sample data** (safe to re-run — it upserts, never duplicates)
   ```
   npm run db:seed
   ```
6. **Start the server**
   ```
   npm run dev
   ```
   You should see:
   ```
   Employee Service listening on http://localhost:5000/api/v1 (env: development)
   API docs: http://localhost:5000/api-docs
   ```
7. **Verify the health endpoint** — open `http://localhost:5000/health` in a browser, or:
   ```
   curl http://localhost:5000/health
   ```
   Expect `{"success":true,"data":{"status":"ok","service":"employee-service"}}`.

## 5. Testing with Postman

Files are in `postman/`:
- `Momo HRMS - Employee Management Service.postman_collection.json`
- `Momo HRMS - Employee Service.postman_environment.json`

**Import both** into Postman (File → Import), select the environment in the top-right dropdown,
then fill in two environment variables before running anything:

- `adminToken` — a valid access token for a user with the `SUPER_ADMIN` or `HR_ADMIN` role. Two
  ways to get one:
  - **Real**: log in through `auth-service`'s `POST /auth/login` (folder **1. Auth** in the
    collection — point its URL at your running auth-service and use a real seeded admin account),
    which auto-captures the token into `adminToken`.
  - **Local-only shortcut** (no auth-service required): mint one yourself, since you already know
    `JWT_ACCESS_SECRET`:
    ```
    node -e "console.log(require('jsonwebtoken').sign({sub:'test-admin', roles:['SUPER_ADMIN']}, require('dotenv').config().parsed.JWT_ACCESS_SECRET))"
    ```
    Paste the output into `adminToken`.
- `internalApiKey` — copy the `INTERNAL_SERVICE_API_KEY` value from your `.env`.

Then run folders **2 through 7** top to bottom (either by hand or with **Runner**). Each folder's
first request captures the ids the later requests need (`departmentId`, `employeeId`, `roleId`,
`deviceId`, `faceTemplateId`) — this collection was run end-to-end with Newman during development
(37 requests, 38 assertions, 0 failures, repeatable) so this order is verified to work.

Covered scenarios (matching the acceptance list): admin login → create department → create
employee → assign role → register device → register face-template → fetch profile → update
employee → deactivate employee → attendance eligibility denied while deactivated → unauthorized
(401) → forbidden (403, an `EMPLOYEE`-role token hitting an admin-only route) → duplicate email
(409) → invalid id (404).

### Swagger / OpenAPI

`http://localhost:5000/api-docs` — interactive docs generated from
`src/docs/openapi.yaml`. Click **Authorize** and paste `Bearer <adminToken>` to try requests from
the browser.

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| `Employee Service cannot start: invalid environment configuration` | Something in `.env` is missing, too short, or still says `change-me...`. Read the specific field named in the error and fix it. |
| `Can't connect to MySQL server` / `ECONNREFUSED` | MySQL isn't running. Windows: Services → start **MySQL80**. Confirm the port in `DATABASE_URL` matches (`3306` by default). |
| `Access denied for user 'momo'@'localhost'` | The password in `DATABASE_URL` doesn't match what you set in step 3, or the user/grant wasn't created. Re-run the `CREATE USER` / `GRANT` statements as root. |
| `prisma generate` / `prisma migrate` fails to download an engine | Your network blocks `binaries.prisma.sh`. Run `npm run prisma:generate` on a machine/network that allows it once (the generated `node_modules/.prisma` client is safe to commit-and-copy or reuse), or apply `prisma/migrations/20260921120000_init/migration.sql` directly with the `mysql` CLI as shown in step 4. |
| `Port 5000 already in use` | Something else is listening on 5000. Either stop it, or set `PORT=5001` (or any free port) in `.env` and restart. |
| `401 INVALID_TOKEN` / `TOKEN_EXPIRED` on every request | `JWT_ACCESS_SECRET` in this service's `.env` doesn't match `auth-service`'s, or the token expired — log in again / mint a new local token. |
| `403 FORBIDDEN` on an admin action | Your token's `roles` claim doesn't include `HR_ADMIN` or `SUPER_ADMIN`. |
| TypeScript compile errors after editing | Run `npm run typecheck` for the full list. Most come from an out-of-date Prisma Client after a schema change — re-run `npm run prisma:generate`. |
| `409 DEPARTMENT_HAS_ACTIVE_EMPLOYEES` when deactivating a department | By design — reassign or deactivate its employees first (see spec §4B). |

## 7. How the Admin portal and the attendance service consume this API

- **Admin portal** (`frontend/web`, and admin screens in `frontend/mobile`) calls
  `http://localhost:5000/api/v1/...` directly with the same `Authorization: Bearer <token>` header
  it already attaches for `auth-service` calls. Every admin-facing endpoint in this service is
  under normal RBAC (`authenticate` + `requireRoles`), so no extra wiring is needed beyond
  pointing the portal's API client at this service's base URL.
- **Attendance service** (not part of this repo yet) should call exactly one endpoint from this
  service — `GET /api/v1/internal/employees/:id/attendance-eligibility` — using a shared secret
  header, **not** a user JWT:
  ```
  X-Internal-Api-Key: <INTERNAL_SERVICE_API_KEY>
  ```
  This is deliberately the *only* thing the attendance service can see: employee id, employment
  status, and three booleans. It never receives a name, email, phone number or any biometric data
  — see `src/modules/attendance-integration/attendance-integration.service.ts`.

## 8. Known limitations / what still needs configuration or testing

Being transparent about what is and isn't done, as requested:

- **Not yet load-tested or run against `auth-service` live.** All JWT verification and the
  RBAC/self-modification rules were verified with locally-minted tokens signed with the same
  secret an `auth-service`-issued token would use — the *verification* path is exercised for
  real, but the *auth-service → employee-service* round trip (login → call this API → role sync
  pushed back to auth-service) has not been run against a live `auth-service` instance in this
  environment.
- **Role sync to auth-service is best-effort and untested against a live target.** If
  `AUTH_SERVICE_URL` is set and `PATCH /employees/:id/role` assigns a role name auth-service
  doesn't recognise (e.g. `MANAGER`), this service still sends it in the `PATCH
  /auth/users/:id` call — auth-service's own validation would need to accept or reject that name;
  this service does not pre-filter it. Worth confirming the exact contract before production use.
- **No automated test suite** (`tests/*.test.ts`, referenced by `npm test`) exists yet — the
  `test` script in `package.json` will report "no test files found" until one is written.
  Verification so far is the Postman/Newman run described above (37/37 green, run twice for
  idempotency) plus a clean `tsc --noEmit` and a clean `npm run build`.
- **No rate limiting** beyond what `helmet`/CORS provide — nothing stops a bulk scripted attack
  on, e.g., `POST /employees`, beyond RBAC.
- **Swagger docs are intentionally not exhaustive.** Every endpoint is listed and callable from
  the Swagger UI, but a few request/response bodies use a generic `object` schema instead of a
  fully-typed one — enough to try requests, not a contract-testing-grade spec.
- **`prisma migrate dev`/`deploy` require network access to `binaries.prisma.sh`** to download the
  schema-engine binary the first time on a new machine. If that's blocked on your network, use the
  raw-SQL fallback in step 4 above — the actual application code only needs the *generated
  client* (`@prisma/client`), which does not need that binary once generated.

## 9. Implemented features checklist

- [x] Employee CRUD, search, filter, pagination, duplicate prevention
- [x] Department CRUD, duplicate prevention, deactivation blocked while active employees exist
- [x] Role listing, employee role assignment (self-elevation and SUPER_ADMIN-target blocked)
- [x] Employment status transitions with a validated state machine, deactivation audit fields
- [x] Employee device registration, listing, update, status transitions (REVOKED→ACTIVE
      restricted to SUPER_ADMIN), duplicate-identifier prevention
- [x] Face-template reference registration/replace-on-conflict, status changes, soft-delete
      (revoke, never hard-delete)
- [x] Full employee profile endpoint (department, role, devices, face-template status)
- [x] Internal attendance-eligibility endpoint, protected by a service API key, minimal payload
- [x] JWT verification reusing the existing auth-service secret; RBAC middleware; self-modify
      guards; admin-or-self read access
- [x] Centralized error handling, Zod validation everywhere, audit logging on every mutation
- [x] Prisma schema + migration (MySQL 8), idempotent seed script
- [x] Swagger/OpenAPI docs served at `/api-docs`
- [x] Postman collection + environment, verified with Newman (37 requests / 38 assertions, 0
      failures, run twice to confirm idempotency)
- [x] `tsc --noEmit` clean, `npm run build` clean
- [ ] Automated test suite (`tests/*.test.ts`) — not started
- [ ] End-to-end run against a live `auth-service` instance — not done in this environment
