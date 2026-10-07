# Employee & Organization Microservice (`employee-service`)

> **Momo HRMS — Core Human Capital & Organizational Management Backbone**  
> Owns employee profiles, organizational hierarchy (departments & designations), office workplace assignments, and inter-service employment authorization checks.

---

## 1. Executive Summary & Purpose

The **Employee Service** is the authoritative master database and business logic engine for all human resource and organizational domain data in the **Smart Employee Attendance & Management System (Momo HRMS)**.

In an enterprise HRMS, identity and attendance rely on organizational context:
- *Who is this person?*
- *What is their official employee code, department, and designation?*
- *Are they an active employee, on probation, on leave, or terminated?*
- *Which physical office branches are they authorized to work from?*
- *Is their branch assignment active today, or is it a scheduled future transfer?*

The Employee Service answers these questions authoritatively with high speed, data integrity, and strict domain boundaries.

---

## 2. Microservice Boundaries & Architectural Philosophy

This service is engineered following **Domain-Driven Design (DDD)** and strict microservice isolation principles:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MOMO HRMS ECOSYSTEM                              │
└─────────────────────────────────────────────────────────────────────────────┘
       │                                     │                         │
       ▼                                     ▼                         ▼
┌──────────────┐                     ┌───────────────┐         ┌───────────────┐
│ Auth Service │                     │EmployeeService│         │GeofenceService│
│ (Port 3001)  │                     │  (Port 3004)  │         │  (Port 3003)  │
└──────┬───────┘                     └───────┬───────┘         └───────┬───────┘
       │                                     ▲                         │
       │ Opaque userId: UUID                 │ Opaque officeId: String │
       └─────────────────────────────────────┼─────────────────────────┘
                                             │
                                   Inter-Service Check:
                           "Is EMP-001 assigned to OFFICE-001?"
                                             │
                                     ┌───────┴──────────┐
                                     │Attendance Service│
                                     │   (Port 3002)    │
                                     └──────────────────┘
```

### What This Service OWNS:
1. **Employee Profiles**: Legal names, contact details, official enterprise code (`employeeCode`), date of joining, and employment lifecycle status (`ACTIVE`, `PROBATION`, `ON_LEAVE`, `TERMINATED`).
2. **Organizational Hierarchy**: Departments (Engineering, Operations, HR) and Designations/Job Titles (Software Engineer, HR Manager).
3. **Office Workplace Assignments**: Many-to-many relationship mapping employees to physical office locations (`officeId`), designated as primary/secondary, with temporal boundaries (`effectiveFrom`, `effectiveTo`).
4. **Inter-Service Employment Authorization**: The single endpoint queried by `attendance-service` to authorize whether a worker is legally permitted to clock in at an office branch.

### What This Service DOES NOT OWN:
- **No Passwords or Tokens**: User credentials, Argon2 password hashes, and JWT tokens belong strictly to `auth-service`. The employee record links to auth via an **opaque, unconstrained string** `userId`.
- **No Physical GPS Polygons**: Office geofence vertices and coordinates belong strictly to `geofence-service`. The employee service only stores the office identifier (e.g. `OFFICE-001`).
- **No Attendance Logs or Timesheets**: Daily clock-in/out timestamps, pauses, and hours worked belong strictly to `attendance-service`.
- **No Biometric Embeddings**: Facial vector embeddings and liveness checks belong strictly to `face-ai-service`.

> **Zero Cross-Database Foreign Keys**: Databases are completely decoupled (`employee_db`, `auth_db`, `attendance_db`, `geofence_db`). If the `auth_db` or `geofence_db` is dropped, migrated, or sharded, `employee-service` maintains total relational consistency within its own tables.

---

## 3. What is Implemented in This Microservice

### A. Employee Identity & Profile Management
- **Enterprise Code Generation & Enforcement**: Every employee has a globally unique `employeeCode` (e.g., `EMP-001`, `EMP-002`) used across physical ID cards, mobile apps, and administrative logs.
- **Multi-Field Dynamic Search & Filtering**: Fast querying across `firstName`, `lastName`, `email`, and `employeeCode` with SQL index backing.
- **Paginated Results Envelope**: Returns paginated responses with metadata (`page`, `limit`, `total`, `totalPages`) avoiding unbounded query performance degradation.
- **Employment Lifecycle Transitions**:
  - `ACTIVE`: Fully active staff; permitted to clock in.
  - `PROBATION`: Newly joined employee; permitted to clock in with probationary tags.
  - `ON_LEAVE`: Temporarily on approved leave; attendance systems can flag or block check-ins.
  - `TERMINATED`: Offboarded employee; all check-in attempts and workplace access are strictly denied.

### B. Organizational Hierarchy (Departments & Designations)
- **Departments Table**: Unique departmental code (`ENG`, `HR`, `OPS`), name, and description.
- **Designations Table**: Unique designation code (`SWE`, `LEAD_ENG`, `HR_EXEC`), title, and foreign-key link to its parent department.
- **Relational Integrity with SetNull**: Deleting a department or designation does not delete employee records; it safely unlinks the association (`onDelete: SetNull`).

### C. Workplace Assignment Engine (`employee_office_assignments`)
- **Multi-Branch Support**: An employee can be assigned to multiple branch offices simultaneously (e.g. traveling technical leads or regional managers).
- **Primary Branch Rule**: Exactly one office is flagged as `isPrimary = true`. When a new office is designated as primary, an atomic Prisma transaction automatically demotes previous primary assignments.
- **Temporal Validity (`effectiveFrom` / `effectiveTo`)**:
  - Supports scheduling office transfers in advance (e.g. "Transferred to Mumbai HQ starting next month").
  - Supports temporary rotations (e.g. "Assigned to Delhi branch from Oct 1 to Oct 15").
  - The inter-service check actively evaluates: `effectiveFrom <= NOW() AND (effectiveTo IS NULL OR effectiveTo >= NOW())`.
- **Fast Deactivation**: Assignments can be deactivated without deleting history (`isActive = false`).

### D. Inter-Service Attendance Authorization (`GET /employees/:id/assignment-check`)
- High-performance, lightweight verification endpoint called directly by `attendance-service` during check-in:
  1. Looks up the employee by UUID or human-readable `employeeCode`.
  2. Verifies that `employmentStatus === 'ACTIVE'`. If terminated or on leave, returns `isAssigned: false`.
  3. Checks if an active, temporally valid assignment exists for the requested `officeId`.
  4. Returns `{ isAssigned: boolean, employeeId: string, officeId: string }`.

### E. Security & Gateway Integration (`GatewayAuthGuard`)
All external traffic passes through the **API Gateway (Port 8000)**. The Employee Service enforces enterprise zero-trust security:
1. **Shared Secret Verification**: Validates the `x-gateway-secret` header against `GATEWAY_SHARED_SECRET`. Direct unauthenticated requests to port `3004` from outside the private network are rejected (`401 Unauthorized`).
2. **HMAC-SHA256 Cryptographic Request Signing**:
   - The Gateway signs every outgoing request: `x-gateway-signature = HMAC-SHA256(url + ":" + timestamp + ":" + secret)`.
   - The `GatewayAuthGuard` recalculates the HMAC signature and verifies that the payload has not been tampered with or spoofed.
3. **Anti-Replay Attack Protection**: Compares `x-gateway-timestamp` against the server clock (`Date.now()`). If the timestamp drift exceeds $\pm 5$ minutes (300,000 ms), the request is rejected with `401 Gateway request signature expired (potential replay attack)`.
4. **Development Auth Bypass**: Set `EMPLOYEE_DEV_AUTH=true` only in local standalone development to test routes without gateway signatures.

---

## 4. Step-by-Step Workflows ("How It Works")

### Workflow 1: New Employee Onboarding & Workplace Assignment
```
Admin / HR User             API Gateway (8000)         Employee Service (3004)        MySQL Database
      │                            │                           │                            │
      │  1. POST /api/v1/employees │                           │                            │
      ├───────────────────────────►│  2. Signs with HMAC       │                            │
      │                            ├──────────────────────────►│                            │
      │                            │                           │  3. Check duplicate code   │
      │                            │                           │     & duplicate email      │
      │                            │                           ├───────────────────────────►│
      │                            │                           │                            │
      │                            │                           │  4. BEGIN TRANSACTION      │
      │                            │                           │     - Insert Employee      │
      │                            │                           │     - Insert Primary Office│
      │                            │                           │  5. COMMIT TRANSACTION     │
      │                            │                           ├───────────────────────────►│
      │                            │  6. 201 Created Payload   │                            │
      │◄───────────────────────────┴───────────────────────────┤                            │
```

1. HR Admin submits employee details (`employeeCode`, `name`, `email`, `departmentId`, `designationId`, and `primaryOfficeId`).
2. The Gateway verifies the admin's JWT bearer token and signs the forwarded request with HMAC-SHA256.
3. `GatewayAuthGuard` validates the signature and timestamp drift.
4. `EmployeeService.createEmployee()` verifies that `employeeCode` and `email` are unique.
5. In an atomic transaction (`prisma.$transaction`), the employee record and the primary office assignment are created together.
6. The full employee profile with nested department, designation, and active assignments is returned.

---

### Workflow 2: Attendance Check-In Verification Handshake
```
Mobile User             Attendance Service (3002)           Employee Service (3004)
     │                             │                                   │
     │  1. Check-In Request        │                                   │
     │     (EMP-001, OFFICE-001)   │                                   │
     ├────────────────────────────►│                                   │
     │                             │  2. GET /employees/EMP-001/assignment-check?officeId=OFFICE-001
     │                             ├──────────────────────────────────►│
     │                             │                                   │ 3. Query DB:
     │                             │                                   │    - Status == ACTIVE?
     │                             │                                   │    - Active assignment?
     │                             │                                   │    - Within effective dates?
     │                             │  4. { isAssigned: true }          │
     │                             │◄──────────────────────────────────┤
     │                             │                                   │
     │                             │  5. Evaluates Geofence & Face AI  │
     │  6. Check-in Accepted       │                                   │
     │◄────────────────────────────┤                                   │
```

1. An employee attempts to check in at Pune Headquarters (`OFFICE-001`).
2. `attendance-service` calls `employee-service`: `GET /api/v1/employees/EMP-001/assignment-check?officeId=OFFICE-001`.
3. `employee-service` checks:
   - Does `EMP-001` exist and have `employmentStatus === 'ACTIVE'`?
   - Is there an assignment for `OFFICE-001` with `isActive === true`?
   - Is today's date between `effectiveFrom` and `effectiveTo`?
4. If any check fails, `isAssigned: false` is returned, and `attendance-service` rejects the check-in immediately.

---

### Workflow 3: Temporal Office Transfer & Primary Branch Demotion
When an employee is transferred to a new office:
1. Admin submits `POST /api/v1/employees/:id/offices` with `{ officeId: "OFFICE-002", isPrimary: true, effectiveFrom: "2026-10-01" }`.
2. Because `isPrimary: true`, the service runs a transaction:
   - Sets `isPrimary: false` for all prior office assignments of this employee.
   - Inserts the new assignment with `isPrimary: true`.
3. Historical records are preserved; the employee's past check-ins at `OFFICE-001` remain auditable.

---

## 5. Database Schema & Data Models (`prisma/schema.prisma`)

```
┌───────────────────────────┐                ┌───────────────────────────┐
│        departments        │                │       designations        │
├───────────────────────────┤                ├───────────────────────────┤
│ id: String (UUID, PK)     │ 1            N │ id: String (UUID, PK)     │
│ code: VarChar(64) UNIQUE  ├───────────────►│ code: VarChar(64) UNIQUE  │
│ name: VarChar(128)        │                │ title: VarChar(128)       │
│ description: VarChar(255) │                │ department_id: UUID (FK)  │
│ created_at / updated_at   │                │ created_at / updated_at   │
└─────────────┬─────────────┘                └─────────────┬─────────────┘
              │ 1                                          │ 1
              │                                            │
              ▼ N                                          ▼ N
┌────────────────────────────────────────────────────────────────────────┐
│                               employees                                │
├────────────────────────────────────────────────────────────────────────┤
│ id: String (UUID, PK)                                                  │
│ employee_code: VarChar(64) UNIQUE                                      │
│ user_id: VarChar(64) UNIQUE (Opaque reference to auth_db)              │
│ first_name: VarChar(64)                                                │
│ last_name: VarChar(64)                                                 │
│ email: VarChar(255) UNIQUE                                             │
│ phone: VarChar(32)                                                     │
│ department_id: UUID (FK -> departments.id, SetNull)                    │
│ designation_id: UUID (FK -> designations.id, SetNull)                  │
│ employment_status: ENUM ('ACTIVE', 'PROBATION', 'ON_LEAVE', 'TERMINATED')│
│ date_of_joining: DateTime                                              │
│ created_at / updated_at                                                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 1
                                    │
                                    ▼ N (Cascade on delete)
┌────────────────────────────────────────────────────────────────────────┐
│                      employee_office_assignments                       │
├────────────────────────────────────────────────────────────────────────┤
│ id: String (UUID, PK)                                                  │
│ employee_id: UUID (FK -> employees.id)                                 │
│ office_id: VarChar(64) (Opaque reference to geofence_db)               │
│ is_primary: Boolean (Default: true)                                    │
│ effective_from: DateTime (Default: now())                              │
│ effective_to: DateTime? (Optional expiration/rotation date)            │
│ is_active: Boolean (Default: true)                                     │
│ created_at / updated_at                                                │
└────────────────────────────────────────────────────────────────────────┘
```

### Table Indexing Strategy:
- `employees`: Indexed on `department_id`, `designation_id`, and `employment_status` for fast filtered queries.
- `employee_office_assignments`: Indexed on `employee_id`, `office_id`, and `is_active` for sub-millisecond assignment lookups.

---

## 6. Complete REST API Reference

All routes are prefixed with `/api/v1` and accessible publicly via the API Gateway at `http://localhost:8000/api/v1/...` (or directly at `http://localhost:3004/api/v1/...` in dev mode).

### 1. List Employees (with Filtering & Pagination)
- **Method**: `GET /api/v1/employees`
- **Query Parameters**:
  - `page` (number, default: `1`): Current page.
  - `limit` (number, default: `20`): Page size.
  - `search` (string, optional): Substring search across `employeeCode`, `firstName`, `lastName`, and `email`.
  - `departmentId` (UUID, optional): Filter by department.
  - `officeId` (string, optional): Filter employees assigned to a specific office.
  - `status` (string, optional): `ACTIVE`, `PROBATION`, `ON_LEAVE`, `TERMINATED`.
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "e1a2b3c4-0000-0000-0000-000000000001",
        "employeeCode": "EMP-001",
        "userId": "298495c1-24e0-4de8-b981-21cbaaa63f8f",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@company.com",
        "phone": "+91 9876543210",
        "employmentStatus": "ACTIVE",
        "dateOfJoining": "2026-01-15T00:00:00.000Z",
        "department": {
          "id": "dept-uuid-001",
          "code": "ENG",
          "name": "Engineering",
          "description": "Software Engineering & Technology"
        },
        "designation": {
          "id": "desig-uuid-001",
          "code": "SWE",
          "title": "Software Engineer"
        },
        "assignments": [
          {
            "id": "assign-uuid-001",
            "officeId": "OFFICE-001",
            "isPrimary": true,
            "isActive": true,
            "effectiveFrom": "2026-01-15T00:00:00.000Z",
            "effectiveTo": null
          }
        ]
      }
    ],
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 2. Get Employee by ID or Employee Code
- **Method**: `GET /api/v1/employees/:id`
- **Path Parameter**: `:id` can be either the UUID or `employeeCode` (e.g. `EMP-001`).
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "e1a2b3c4-0000-0000-0000-000000000001",
    "employeeCode": "EMP-001",
    "userId": "298495c1-24e0-4de8-b981-21cbaaa63f8f",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@company.com",
    "phone": "+91 9876543210",
    "employmentStatus": "ACTIVE",
    "department": { "id": "dept-uuid-001", "name": "Engineering" },
    "designation": { "id": "desig-uuid-001", "title": "Software Engineer" }
  }
}
```
- **Error Response (`404 Not Found`)**:
```json
{
  "success": false,
  "error": {
    "code": "EMPLOYEE_NOT_FOUND",
    "message": "Employee not found",
    "statusCode": 404
  }
}
```

---

### 3. Get Employee Profile by Auth User ID
- **Method**: `GET /api/v1/employees/by-user/:userId`
- **Purpose**: Used by the frontend upon login to resolve the authenticated user's HR profile.
- **Response (`200 OK`)**: Returns the full employee profile associated with `userId`.

---

### 4. Create New Employee (Onboarding)
- **Method**: `POST /api/v1/employees`
- **Request Body**:
```json
{
  "employeeCode": "EMP-002",
  "firstName": "Sarah",
  "lastName": "Connor",
  "email": "sarah.connor@company.com",
  "phone": "+91 9123456780",
  "departmentId": "dept-uuid-001",
  "designationId": "desig-uuid-001",
  "primaryOfficeId": "OFFICE-001",
  "employmentStatus": "ACTIVE",
  "dateOfJoining": "2026-09-01T00:00:00.000Z"
}
```
- **Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "id": "e2a3b4c5-0000-0000-0000-000000000002",
    "employeeCode": "EMP-002",
    "firstName": "Sarah",
    "lastName": "Connor",
    "email": "sarah.connor@company.com",
    "employmentStatus": "ACTIVE"
  },
  "message": "Employee created successfully"
}
```
- **Error Response (`409 Conflict - Duplicate Code or Email`)**:
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_EMPLOYEE_CODE",
    "message": "Employee with code EMP-002 already exists",
    "statusCode": 409
  }
}
```

---

### 5. Update Employee Profile
- **Method**: `PATCH /api/v1/employees/:id`
- **Request Body**: (all fields optional)
```json
{
  "firstName": "Sarah",
  "lastName": "Connor-Reese",
  "phone": "+91 9999988888",
  "employmentStatus": "ACTIVE",
  "userId": "auth-user-uuid-999"
}
```
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "e2a3b4c5-0000-0000-0000-000000000002",
    "employeeCode": "EMP-002",
    "lastName": "Connor-Reese"
  },
  "message": "Employee updated successfully"
}
```

---

### 6. Office Assignment & Authorization (Inter-Service Check)
- **Method**: `GET /api/v1/employees/:id/assignment-check?officeId=OFFICE-001`
- **Purpose**: Internal handshake endpoint invoked by `attendance-service`.
- **Response (`200 OK` - Authorized)**:
```json
{
  "success": true,
  "data": {
    "isAssigned": true,
    "employeeId": "EMP-001",
    "officeId": "OFFICE-001"
  }
}
```
- **Response (`200 OK` - Unauthorized or Terminated)**:
```json
{
  "success": true,
  "data": {
    "isAssigned": false,
    "employeeId": "EMP-001",
    "officeId": "OFFICE-999"
  }
}
```

---

### 7. Assign Office Workplace to Employee
- **Method**: `POST /api/v1/employees/:id/offices`
- **Request Body**:
```json
{
  "officeId": "OFFICE-002",
  "isPrimary": false,
  "effectiveFrom": "2026-10-01T00:00:00.000Z",
  "effectiveTo": "2026-12-31T23:59:59.000Z"
}
```
- **Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "id": "assign-uuid-002",
    "employeeId": "e1a2b3c4-0000-0000-0000-000000000001",
    "officeId": "OFFICE-002",
    "isPrimary": false,
    "isActive": true
  },
  "message": "Office assignment created"
}
```

---

### 8. Deactivate Office Assignment
- **Method**: `DELETE /api/v1/employees/offices/:assignmentId`
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "assign-uuid-002",
    "isActive": false
  },
  "message": "Office assignment deactivated"
}
```

---

### 9. Organizational Units (Departments & Designations)
- `GET /api/v1/organization/departments`: Lists all departments along with nested designations.
- `POST /api/v1/organization/departments`: Creates a new department (`{ "code": "FIN", "name": "Finance", "description": "Accounting & Payroll" }`).
- `GET /api/v1/organization/designations?departmentId=...`: Lists designations, optionally filtered by department.
- `POST /api/v1/organization/designations`: Creates a new designation (`{ "code": "ACC", "title": "Senior Accountant", "departmentId": "..." }`).

---

## 7. Environment Configuration Reference (`.env`)

| Variable | Description | Example / Recommended Value |
|---|---|---|
| `PORT` | Local HTTP port for the microservice | `3004` |
| `NODE_ENV` | Runtime environment (`development`, `production`, `test`) | `development` |
| `API_PREFIX` | Global route prefix | `api/v1` |
| `CORS_ORIGINS` | Permitted browser origins for direct CORS requests | `http://localhost:3000,http://localhost:8000` |
| `DATABASE_URL` | MySQL connection string (sanitized for security) | `mysql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:3306/employee_db` |
| `GATEWAY_SHARED_SECRET` | Shared symmetric secret used for HMAC-SHA256 signature verification | `your-internal-gateway-shared-secret` |
| `GATEWAY_SHARED_SECRET_HEADER` | Header key where API Gateway sends the secret | `x-gateway-secret` |
| `GATEWAY_ROLES_HEADER` | Header key where API Gateway forwards JWT user roles | `x-roles` |
| `EMPLOYEE_DEV_AUTH` | When `true`, disables HMAC and secret verification for isolated testing | `false` (keep `false` in production) |

---

## 8. Developer Guide: Setup, Migrations & Local Verification

### Step 1: Install Dependencies
```bash
cd backend/employee-service
npm install
```

### Step 2: Configure Environment
Copy the example environment template:
```bash
cp .env.example .env
```
Ensure your MySQL database `employee_db` is created:
```sql
CREATE DATABASE IF NOT EXISTS employee_db;
```

### Step 3: Run Prisma Migrations & Client Generation
```bash
npm run prisma:generate
npm run prisma:migrate:dev --name init
```

### Step 4: Seed Baseline Organization Data
```bash
npm run prisma:seed
```
*Seeds the default Engineering department (`ENG`), Software Engineer designation (`SWE`), and demo employee profile `EMP-001` (John Doe).*

### Step 5: Start the Microservice
```bash
# Development watch mode
npm run start:dev

# Production build
npm run build
npm run start:prod
```
The service will start and listen on `http://localhost:3004`. Health check is available at `GET http://localhost:3004/api/v1/health`.

### Step 6: Test Endpoints via cURL

```bash
# 1. Health Check
curl http://localhost:3004/api/v1/health

# 2. Get Employee EMP-001 (Dev Mode with header or through Gateway on 8000)
curl -X GET http://localhost:8000/api/v1/employees/EMP-001

# 3. Inter-Service Office Assignment Check
curl "http://localhost:8000/api/v1/employees/EMP-001/assignment-check?officeId=OFFICE-001"

# 4. List Departments
curl http://localhost:8000/api/v1/organization/departments
```

---

## 9. Error Code Catalog

The Employee Service utilizes structured `AppException` error responses with unified error codes:

| Error Code | HTTP Status | Description |
|---|---|---|
| `DUPLICATE_EMPLOYEE_CODE` | `409 Conflict` | An employee with this `employeeCode` already exists. |
| `DUPLICATE_EMAIL` | `409 Conflict` | An employee with this `email` already exists. |
| `EMPLOYEE_NOT_FOUND` | `404 Not Found` | The specified employee UUID or code does not exist. |
| `DUPLICATE_ASSIGNMENT` | `409 Conflict` | The employee is already actively assigned to this office. |
| `DEPARTMENT_NOT_FOUND` | `404 Not Found` | The requested department UUID does not exist. |
| `DESIGNATION_NOT_FOUND` | `404 Not Found` | The requested designation UUID does not exist. |
| `UNAUTHORIZED` | `401 Unauthorized` | Missing or invalid gateway shared secret or HMAC signature. |
