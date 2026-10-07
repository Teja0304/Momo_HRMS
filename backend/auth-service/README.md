# Authentication & Authorization Microservice (`auth-service`)

> **Momo HRMS — Central Identity Provider, Session Management & RBAC Security Engine**  
> Manages user credentials, Argon2 password hashing, short-lived JWT access tokens, rotating cryptographically-hashed refresh sessions, role-based access control (RBAC), and fine-grained permissions.

---

## 1. Executive Summary & Purpose

The **Auth Service** is the central gatekeeper and identity provider for the entire **Smart Employee Attendance & Management System (Momo HRMS)**.

In an enterprise platform handling sensitive biometrics, GPS coordinates, and payroll records, security begins with identity:
- *Is this user who they claim to be?*
- *Has their password been securely hashed with modern cryptographic resistance against GPU cracking?*
- *Are their session refresh tokens protected against replay and theft?*
- *What enterprise roles (`SUPER_ADMIN`, `HR_ADMIN`, `EMPLOYEE`) and granular permissions (`employee.create`, `attendance.approve`) do they hold?*
- *Has an administrator deactivated their account or forced a password reset?*

The Auth Service manages credentials, JWT session lifecycles, and authorization rules with zero knowledge of employee HR records, geofences, or attendance sessions.

---

## 2. Microservice Boundaries & Architectural Principles

Following **Domain-Driven Design (DDD)** and zero-trust principles:

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
             Auth Service (Port 3001)         Downstream Services (3002-3006)
                      │                       (Attendance, Employee, Geofence)
            [Central Identity Vault]                    │
                      │                                 │
                      ├──► Issues Access Token (JWT) ───┤
                      │    (Includes userId, roles)     │
                      │                                 │
                      └──► Validates Login & Rotates ◄──┘
                           Refresh Tokens
```

### What This Service OWNS:
1. **User Authentication Accounts**: Usernames, email addresses, Argon2 password hashes, active flags, and last login timestamps.
2. **Access & Refresh Tokens**: Issuing signed, tamper-evident RS256/HS256 JWT access tokens and managing multi-device refresh token sessions.
3. **Role-Based Access Control (RBAC)**: Role catalog (`SUPER_ADMIN`, `HR_ADMIN`, `EMPLOYEE`), granular permissions catalog, and many-to-many user/role/permission mappings.
4. **Credential Security**: Forced password resets on first login (`mustChangePassword`), password changes, and account deactivation.

### What This Service DOES NOT OWN:
- **No HR Profiles**: First/last names, phone numbers, departments, and job titles belong strictly to `employee-service`. The user record is linked to an employee profile via an **opaque string** `userId`.
- **No Biometric Data**: Facial vectors belong strictly to `face-ai-service`.
- **No GPS or Geofencing**: Polygon definitions belong strictly to `geofence-service`.
- **No Attendance Timesheets**: Clock-in sessions belong strictly to `attendance-service`.

---

## 3. What is Implemented in This Microservice

### A. Argon2id Cryptographic Password Hashing
- Utilizes **Argon2id** (the winner of the Password Hashing Competition) with tuned memory cost, time cost, and parallelism.
- Resistant against GPU-accelerated brute force and ASIC dictionary attacks, unlike legacy MD5 or SHA-256 hashes.
- Automatically generates unique, cryptographically random 16-byte salts for every user.

### B. Rotating Refresh-Token Session Architecture
To protect against token theft and man-in-the-middle attacks:
- **Short-Lived Access Tokens**: JWT access tokens are short-lived (e.g. 15 minutes) and hold minimal claims (`sub: userId`, `roles: [...]`).
- **Rotating Refresh Tokens**: Refresh tokens are long-lived (e.g. 7 days). On every refresh request (`POST /auth/refresh`), **the presented refresh token is immediately invalidated (revoked)** and a new token pair is issued.
- **SHA-256 Token Hashing at Rest**: Raw refresh tokens are never stored in the database. Only a SHA-256 hash of the token (`token_hash`) is persisted in `refresh_token_sessions`. If the database is compromised, active session tokens cannot be extracted.
- **Session Revocation & Logout**: Single session revocation (`POST /auth/logout`) and global revocation across all devices (`POST /auth/logout-all`).

### C. Forced Password Change on First Login (`mustChangePassword`)
- To avoid default hardcoded passwords, newly provisioned accounts are created with `mustChangePassword = true`.
- The global `PasswordChangeGuard` intercepts every incoming request for that user.
- If `mustChangePassword === true`, **all API access is blocked with `403 PASSWORD_CHANGE_REQUIRED`**, except for:
  - `GET /auth/me` (to fetch profile state)
  - `POST /auth/change-password` / `POST /auth/set-initial-password`
  - `POST /auth/logout`
- The user is forced to set a strong, private password before accessing the system.

### D. Multi-Tier RBAC Guard Pipeline
Incoming requests pass through a three-stage authorization pipeline:
```
Request ──► [JwtAuthGuard] ──► [RolesGuard] ──► [PermissionsGuard] ──► Controller Action
```
1. **`JwtAuthGuard`**: Verifies JWT signature, expiration, and extracts `userId` and `roles`. (Can be bypassed on public endpoints using `@Public()`).
2. **`RolesGuard`**: Checks if the user's assigned roles satisfy route decorators (e.g. `@Roles('SUPER_ADMIN', 'HR_ADMIN')`).
3. **`PermissionsGuard`**: Resolves user permissions fresh from the database on every request (`JwtStrategy.validate`). If an administrator revokes a permission, access is cut off immediately without waiting for the 15-minute JWT to expire.

### E. Defensive Data Sanitization (`SanitizeResponseInterceptor`)
- Automatically intercepts all outgoing HTTP response payloads.
- Recursively strips sensitive fields like `passwordHash`, `tokenHash`, and salt strings, ensuring internal credentials are never leaked over the wire.

### F. Rate Limiting & Anti-Brute-Force Shield
- `LoginThrottlerGuard` enforces strict request thresholds on sensitive endpoints (`POST /auth/login`, `POST /auth/refresh`).
- Evaluated per `IP + email` pair to prevent credential stuffing attacks.
- Coupled with Gateway-level throttlers (max 5 login attempts per minute per IP).

---

## 4. Step-by-Step Workflows ("How It Works")

### Workflow 1: User Provisioning & First-Time Login
```
Super Admin / HR             Auth Service (3001)               Employee User
       │                              │                              │
       │ 1. POST /auth/users          │                              │
       │    (email, temporary pass)   │                              │
       ├─────────────────────────────►│                              │
       │                              │ 2. Creates user with:        │
       │                              │    mustChangePassword: true  │
       │ 3. 201 Created               │                              │
       │◄─────────────────────────────┤                              │
       │                              │                              │
       │  4. Share credentials        │                              │
       └──────────────────────────────┼─────────────────────────────►│
                                      │                              │
                                      │ 5. POST /auth/login          │
                                      │◄─────────────────────────────┤
                                      │ 6. 200 OK:                   │
                                      │    mustChangePassword: true  │
                                      ├─────────────────────────────►│
                                      │                              │
                                      │ 7. Tries GET /attendance     │
                                      │◄─────────────────────────────┤
                                      │ 8. 403 Forbidden:            │
                                      │    PASSWORD_CHANGE_REQUIRED  │
                                      ├─────────────────────────────►│
                                      │                              │
                                      │ 9. POST /auth/change-password│
                                      │◄─────────────────────────────┤
                                      │ 10. mustChangePassword=false │
                                      │     200 Password Updated     │
                                      ├─────────────────────────────►│
```

---

### Workflow 2: Dual-Token Rotation Dance
1. **Initial Login**: User submits credentials to `POST /auth/login`. Auth Service verifies Argon2 hash, generates access token (15m) and refresh token (7d). Stores SHA-256 hash in `refresh_token_sessions`.
2. **Access Token Expiry**: After 15 minutes, API calls return `401 Unauthorized (Token Expired)`.
3. **Rotation Call**: Client submits `POST /auth/refresh` with `{ refreshToken }`.
4. **Validation & Atomic Rotation**:
   - Auth Service computes `SHA256(refreshToken)`.
   - Finds matching record where `revokedAt IS NULL` and `expiresAt > NOW()`.
   - **Immediately marks the old token as revoked** (`revokedAt = NOW()`).
   - Issues a brand new access token and a brand new refresh token.
5. **Replay Detection**: If a stolen refresh token is re-submitted after being revoked, the server detects token reuse, immediately flags the session as compromised, and revokes all active sessions for that user.

---

## 5. Database Schema & Data Models (`prisma/schema.prisma`)

```
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│              users              │           │              roles              │
├─────────────────────────────────┤           ├─────────────────────────────────┤
│ id: UUID (PK)                   │ 1       N │ id: UUID (PK)                   │
│ username: VarChar(64) UNIQUE    ├──────────►│ name: VarChar(64) UNIQUE        │
│ email: VarChar(255) UNIQUE      │           │ description: VarChar(255)       │
│ password_hash: VarChar(255)     │           │ created_at / updated_at         │
│ full_name: VarChar(150)?        │           └───────────────┬─────────────────┘
│ is_active: Boolean              │                           │ 1
│ must_change_password: Boolean   │                           │
│ last_login_at: DateTime?        │                           ▼ N
│ created_at / updated_at         │           ┌─────────────────────────────────┐
└───────────────┬─────────────────┘           │        role_permissions         │
                │ 1                           ├─────────────────────────────────┤
                │                             │ role_id: UUID (FK)              │
                ▼ N                           │ permission_id: UUID (FK)        │
┌─────────────────────────────────┐           └───────────────┬─────────────────┘
│     refresh_token_sessions      │                           │ N
├─────────────────────────────────┤                           │
│ id: UUID (PK)                   │                           ▼ 1
│ user_id: UUID (FK -> users.id)  │           ┌─────────────────────────────────┐
│ token_hash: VarChar(255) UNIQUE │           │           permissions           │
│ expires_at: DateTime            │           ├─────────────────────────────────┤
│ revoked_at: DateTime?           │           │ id: UUID (PK)                   │
│ ip_address: VarChar(64)?        │           │ name: VarChar(128) UNIQUE       │
│ user_agent: VarChar(255)?       │           │ description: VarChar(255)       │
│ created_at / updated_at         │           │ created_at / updated_at         │
└─────────────────────────────────┘           └─────────────────────────────────┘
```

---

## 6. Complete REST API Reference

All routes are prefixed with `/api/v1` and accessible publicly via the API Gateway at `http://localhost:8000/api/v1/...`.

### 1. User Login (`POST /api/v1/auth/login`)
- **Request Body**:
```json
{
  "email": "employee@company.com",
  "password": "TemporaryPassword123!"
}
```
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "7f8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b",
    "user": {
      "id": "u1a2b3c4-0000-0000-0000-000000000001",
      "email": "employee@company.com",
      "username": "john.doe",
      "fullName": "John Doe",
      "mustChangePassword": false,
      "roles": ["EMPLOYEE"],
      "permissions": ["attendance.record", "attendance.view"]
    }
  },
  "message": "Login successful"
}
```
- **Error Response (`401 Unauthorized`)**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid credentials",
    "statusCode": 401
  }
}
```
*(Notice: Never reveals whether the email exists or if the password was wrong).*

---

### 2. Refresh Token (`POST /api/v1/auth/refresh`)
- **Request Body**:
```json
{
  "refreshToken": "7f8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b"
}
```
- **Response (`200 OK`)**: Returns new `{ accessToken, refreshToken }` pair.

---

### 3. Logout Current Device (`POST /api/v1/auth/logout`)
- **Headers**: `Authorization: Bearer <accessToken>`
- Revokes the calling session token in `refresh_token_sessions`.

---

### 4. Logout All Devices (`POST /api/v1/auth/logout-all`)
- **Headers**: `Authorization: Bearer <accessToken>`
- Marks all active refresh sessions for this user as `revokedAt = NOW()`.

---

### 5. Change Password (`POST /api/v1/auth/change-password`)
- **Request Body**:
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePassword2026!"
}
```
- **Response (`200 OK`)**: Updates Argon2 hash, sets `mustChangePassword = false`, and revokes all active sessions.

---

### 6. User Administration (SUPER_ADMIN / HR_ADMIN)
- `POST /api/v1/auth/users`: Provisions a new user account.
- `GET /api/v1/auth/users`: Lists users with pagination and search.
- `GET /api/v1/auth/users/:id`: Fetches user profile, roles, and status.
- `PATCH /api/v1/auth/users/:id/status`: Activates or deactivates user (`{ "isActive": false }`).
- `POST /api/v1/auth/users/:id/reset-password`: Sets a temporary password and forces reset.

---

## 7. Environment Configuration Reference (`.env`)

| Variable | Description | Example / Recommended Value |
|---|---|---|
| `PORT` | Local HTTP port for the auth service | `3001` |
| `DATABASE_URL` | MySQL connection string (sanitized) | `mysql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:3306/auth_db` |
| `JWT_SECRET` | Secret key used for signing access tokens | `your-cryptographic-jwt-secret-at-least-32-chars` |
| `JWT_EXPIRATION` | Access token lifespan | `15m` |
| `REFRESH_TOKEN_EXPIRATION_DAYS`| Refresh token session duration | `7` |
| `BOOTSTRAP_SUPER_ADMIN_EMAIL` | Default bootstrap administrator email | `admin@company.com` |
| `BOOTSTRAP_SUPER_ADMIN_PASSWORD` | Default bootstrap administrator password | `AdminSecurePass2026!` |

---

## 8. Local Setup & Testing

```bash
# 1. Install dependencies
cd backend/auth-service
npm install

# 2. Run Prisma migrations
npm run prisma:generate
npm run prisma:migrate:dev --name init

# 3. Seed roles, permissions, and bootstrap Super Admin
npm run prisma:seed

# 4. Start in watch mode
npm run start:dev

# 5. Run test suites
npm run test
```
