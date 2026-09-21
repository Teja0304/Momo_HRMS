# Auth Service

Authentication & Authorization microservice for the Smart Employee Attendance &
Management System. Owns user credentials, JWT issuance, refresh-token
sessions, roles, and permissions — nothing else.

## What this service owns (and doesn't)

**Owns:** users, roles, permissions, user↔role mapping, role↔permission
mapping, refresh-token sessions, password hashing, JWT issuance.

**Does NOT own:** employee profiles, departments, offices, attendance,
geofences, face data, notifications, reports. Those belong to other
microservices that will be built later and will treat this service's
access tokens as their source of truth for "who is this and what can they
do."

> Note on the database engine: the tech-stack section of the spec named
> MySQL, while the seeding section referenced PostgreSQL. This
> implementation uses **MySQL** (via Prisma) to match the primary stack
> section and the "mySQL + PostGIS" system-wide datastore mentioned for
> the overall architecture. Switching the Prisma `datasource` provider to
> `postgresql` is a one-line change if the team decides otherwise.

## Tech stack

Node.js, NestJS, TypeScript, Prisma (MySQL), JWT (`@nestjs/jwt`), Argon2
password hashing, `class-validator`/`class-transformer`, Swagger/OpenAPI,
Jest/Supertest, Docker/Docker Compose. Redis is wired for future
distributed rate limiting but is **not required** to run the service.

## Getting started

```bash
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

Or with Docker Compose (spins up MySQL alongside the service):

```bash
cp .env.example .env
docker compose up --build
```

Swagger docs: `http://localhost:3001/api/v1/docs`
Health check: `http://localhost:3001/api/v1/health`

## Seeding

`npm run prisma:seed` creates the three initial roles (`EMPLOYEE`,
`HR_ADMIN`, `SUPER_ADMIN`), the initial permission catalogue, and wires
the role→permission mappings described in the spec. It is **idempotent**
— safe to run repeatedly (uses `upsert`).

Optionally set `BOOTSTRAP_SUPER_ADMIN_EMAIL` / `_USERNAME` / `_PASSWORD`
in `.env` before seeding to create a first SUPER_ADMIN account so you
have a way into the system immediately (no public registration exists by
design).

## API

All routes are prefixed with `/api/v1`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | Public (rate-limited) | Authenticate, receive access + refresh tokens |
| POST | `/auth/refresh` | Public (rate-limited) | Rotate a refresh token for a new token pair |
| POST | `/auth/logout` | Bearer | Revoke the current refresh-token session |
| POST | `/auth/logout-all` | Bearer | Revoke every session for the current user |
| GET | `/auth/me` | Bearer | Current user + roles + permissions |
| POST | `/auth/change-password` | Bearer | Change password; revokes all sessions afterward |
| POST | `/auth/set-initial-password` | Bearer, only while `mustChangePassword: true` | First-login password set — no current-password field |
| POST | `/auth/users` | Bearer, `SUPER_ADMIN` | Provision a new user (no public registration) |
| GET | `/auth/users` | Bearer, `SUPER_ADMIN`/`HR_ADMIN` | List users |
| GET | `/auth/users/:id` | Bearer, `SUPER_ADMIN`/`HR_ADMIN` | Get one user |
| PATCH | `/auth/users/:id` | Bearer, `SUPER_ADMIN` | Update `fullName`/`email`/`roles` |
| PATCH | `/auth/users/:id/status` | Bearer, `SUPER_ADMIN` | Activate/deactivate a user |
| POST | `/auth/users/:id/reset-password` | Bearer, `SUPER_ADMIN` | Admin sets a new temporary password; forces reset + revokes sessions |
| GET | `/auth/roles` | Bearer, `role.manage` | List roles + their permissions |
| POST | `/auth/roles` | Bearer, `SUPER_ADMIN` + `role.manage` | Create a role |
| PATCH | `/auth/roles/:id` | Bearer, `SUPER_ADMIN` + `role.manage` | Update a role's description/permissions |
| GET | `/auth/permissions` | Bearer, `role.manage` | List the permission catalogue |
| GET | `/health` | Public | Liveness/readiness, including DB connectivity |

### Login

```
POST /api/v1/auth/login
{ "email": "employee@company.com", "password": "password" }
```

Returns `{ accessToken, refreshToken, user: { id, email, username, roles, permissions } }`.
On failure, always returns a generic `401 Invalid credentials` — the
response never reveals whether the email exists or whether the password
was wrong (spec §15).

### Refresh

```
POST /api/v1/auth/refresh
{ "refreshToken": "..." }
```

Refresh tokens are **rotated** on every use: the presented session is
revoked and a new one issued. A hashed (SHA-256) copy of the token is
stored server-side in `refresh_token_sessions`; only a valid signature
**and** a matching, non-revoked, non-expired DB record are accepted —
possession of a structurally-valid JWT alone is never enough.

## Forced password change on first login

Users created via `POST /auth/users` are given a temporary password and
start with `mustChangePassword: true`. This flag comes back in the
`login`/`refresh` response's `user` object and in `GET /auth/me`.

While `mustChangePassword` is `true`, **every other endpoint returns
`403 { error: "PASSWORD_CHANGE_REQUIRED" }`** except `/auth/me`,
`/auth/change-password`, `/auth/logout`, and `/auth/logout-all`
(enforced by the global `PasswordChangeGuard`). The frontend should
check this flag right after login and route the user straight to a
"set your password" screen before letting them do anything else.
Calling `POST /auth/change-password` successfully clears the flag.

See `DEPLOYMENT.md` for generating real secrets and deploying this
somewhere your frontend team can reach.

## RBAC architecture

```
JwtAuthGuard  →  RolesGuard  →  PermissionsGuard  →  Controller
```

All three are registered as global guards (`APP_GUARD`) in `AppModule`,
so every route is protected by default. Opt out with `@Public()`; add
`@Roles('HR_ADMIN', 'SUPER_ADMIN')` and/or `@Permissions('employee.create')`
to tighten a route further. `RolesGuard`/`PermissionsGuard` are no-ops on
routes with no matching decorator.

The JWT access token payload is intentionally minimal — `{ sub, roles }`
only. Permissions are resolved fresh from the database on every request
(`JwtStrategy.validate`), so revoking a permission or deactivating a user
takes effect immediately rather than waiting out a 15-minute access token.

This guard/decorator pattern (`@Roles`, `@Permissions`, the JWT payload
shape) is designed to be reused as-is by future services sitting behind
the same API Gateway, once they receive/validate access tokens issued
here.

## Security notes

- Passwords hashed with Argon2; refresh tokens hashed with SHA-256
  (high-entropy random tokens don't need a slow KDF, unlike passwords).
- `password_hash` and `token_hash` are never selected into API responses,
  and `SanitizeResponseInterceptor` strips them defensively even if a
  service method accidentally returns a raw entity.
- Login/refresh are rate-limited per `ip + email` via `LoginThrottlerGuard`,
  built on `@nestjs/throttler`'s in-memory storage by default — no Redis
  dependency to run locally. Swap in Redis-backed storage in `AuthModule`
  to scale horizontally without touching any other code.
- Helmet for secure headers, explicit CORS allow-list, global
  `ValidationPipe` with `whitelist`/`forbidNonWhitelisted`, structured
  JSON error responses via a global exception filter.

## Project structure

```
src/
├── auth/            # login/refresh/logout/me/change-password, guards, strategies, decorators
├── users/            # user provisioning & lookups
├── roles/            # role CRUD + role-permission wiring
├── permissions/       # permission catalogue (read-only)
├── prisma/            # PrismaService/Module
├── common/            # cross-cutting decorators, guards constants, filters, interceptors
├── config/            # typed env configuration
├── health/            # liveness/readiness
├── app.module.ts
└── main.ts
prisma/
├── schema.prisma
└── seed.ts
test/                  # e2e tests
```

## Tests

```bash
npm run test        # unit tests
npm run test:e2e     # e2e tests (health check mocks Prisma, no DB required)
npm run test:cov     # coverage
```

## Roadmap / integration notes for other services

- The Employee Service should call `UsersService.createUser` (in-process,
  if ever merged) or a future internal/service-to-service endpoint using
  the same underlying logic, rather than duplicating user provisioning.
- Any new service sitting behind the API Gateway can validate access
  tokens issued here using the same JWT secret/algorithm and reuse the
  `@Roles`/`@Permissions` decorator pattern.
- New permissions can be added at any time — extend the `PERMISSIONS`
  array in `prisma/seed.ts` and re-run the (idempotent) seed script.
