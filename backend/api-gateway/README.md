# API Gateway Microservice (`api-gateway`)

> **Momo HRMS — Central Reverse Proxy, Security Gatekeeper, Rate Limiter & Cryptographic HMAC Request Signer**  
> Acts as the single unified public entry point for both **React Web** and **React Native Mobile** frontend clients. Handles reverse proxying to all 6 backend microservices, enforces IP-based rate limiting, enriches downstream requests with validated JWT identity headers, and cryptographically signs outgoing requests with HMAC-SHA256 to prevent internal port spoofing.

---

## 1. Executive Summary & Core Purpose

In a microservice ecosystem consisting of 6 specialized services (Auth, Attendance, Geofence, Employee, Notification, Face AI), frontend web and mobile clients cannot realistically manage six separate URLs, ports, CORS policies, and connection states.

The **API Gateway** solves this by serving as the unified ingress controller:
- **Single Host & Port**: All frontend communication targets `http://localhost:8000/api/v1/...`.
- **Zero-Trust Downstream Security**: Internal microservice ports (3001–3006) are never directly exposed to end users. The gateway cryptographically signs every forwarded request using HMAC-SHA256, proving the request originated from the authentic gateway.
- **Traffic Protection & Anti-Brute-Force**: Enforces rate limiting on sensitive routes (5 attempts/min on login, 10 attempts/min on face verification).
- **Identity Decoupling**: Validates user JWTs at the gateway boundary and passes enriched identity headers (`x-user-id`, `x-employee-id`, `x-roles`) to downstream services.
- **Unbuffered SSE Streaming**: Allows persistent Server-Sent Events (SSE) connections to stream through without buffering or socket timeouts.

---

## 2. System Architecture & Route Topology

```
                                  ┌────────────────────────┐
                                  │   React Web / Mobile   │
                                  └───────────┬────────────┘
                                              │ (HTTP / JSON / SSE)
                                              ▼
                              ┌────────────────────────────────┐
                              │    API GATEWAY (Port 8000)     │
                              │                                │
                              │  - Throttler / Rate Limiting   │
                              │  - JWT Claim Enrichment        │
                              │  - HMAC-SHA256 Request Signer  │
                              │  - Dynamic Reverse Proxy       │
                              └───────┬────────────────┬───────┘
                                      │                │
            ┌─────────────────────────┼────────────────┼─────────────────────────┐
            │                         │                │                         │
            ▼                         ▼                ▼                         ▼
      Auth Service             Attendance Svc    Geofence Svc              Employee Svc
       (Port 3001)               (Port 3002)      (Port 3003)               (Port 3004)
     /api/v1/auth/*        /api/v1/attendance/*  /api/v1/geofence/*    /api/v1/employees/*
                                                 /api/v1/offices/*     /api/v1/organization/*
                                      │                │
                                      ▼                ▼
                             Notification Svc    Face AI Service
                               (Port 3005)         (Port 3006)
                          /api/v1/notifications/*  /api/v1/face/*
```

### Route-to-Microservice Mapping Matrix:
| Gateway Public Route | Target Microservice | Internal Port | Protocol | Ownership Domain |
|---|---|---|---|---|
| `/api/v1/auth/*` | Auth Service | `3001` | HTTP / JSON | Credentials, JWT tokens, RBAC permissions |
| `/api/v1/attendance/*` | Attendance Service | `3002` | HTTP / JSON | State machine, timesheets, pauses, auto-checkout |
| `/api/v1/geofence/*` | Geofence Service | `3003` | HTTP / JSON | Spatial Ray-Casting & distance verification |
| `/api/v1/offices/*` | Geofence Service | `3003` | HTTP / JSON | Office branches and polygon coordinates |
| `/api/v1/employees/*` | Employee Service | `3004` | HTTP / JSON | HR profiles, lifecycle, office assignments |
| `/api/v1/organization/*` | Employee Service | `3004` | HTTP / JSON | Departments and designations |
| `/api/v1/notifications/*` | Notification Service | `3005` | HTTP / SSE | In-app alerts, unread counts, real-time push |
| `/api/v1/face/*` | Face AI Service | `3006` | HTTP / JSON | Active liveness, anti-spoofing, vector encryption |

---

## 3. What is Implemented in This Microservice

### A. Dynamic Reverse Proxying (`http-proxy-middleware`)
- Built upon NestJS and Express middleware utilizing `http-proxy-middleware`.
- Strips gateway hops cleanly and streams request bodies directly to target microservices.
- **Fixed Request Body Serialization Order**: Ensures custom headers (HMAC signatures, timestamps, gateway secret) are written to the `ClientRequest` *prior* to invoking `fixRequestBody(proxyReq, req)` to avoid `ERR_HTTP_HEADERS_SENT` stream lockouts.

### B. Rate Limiting & Anti-Brute-Force Protection (`@nestjs/throttler`)
- **Authentication Route (`/api/v1/auth/login`)**:
  - Maximum **5 attempts per minute per IP**.
  - Prevents credential stuffing, dictionary attacks, and password guessing.
  - Returns `429 Too Many Requests` (`ThrottlerException`) with `Retry-After` headers.
- **Biometric Verification (`/api/v1/face/verify`)**:
  - Maximum **10 attempts per minute per employee/IP**.
  - Blocks automated photo-iteration attacks and presentation spoof testing.
- **Global Ingress**:
  - Maximum 100 requests per minute per IP across standard read endpoints.

### C. HMAC-SHA256 Cryptographic Request Signing
Even if an attacker discovers internal microservice ports (e.g. 3001–3006) on the internal network:
1. Downstream services will **reject** direct requests that do not carry a valid HMAC signature.
2. The Gateway computes:
   $$\text{Signature} = \text{HMAC-SHA256}_{\text{GATEWAY\_SHARED\_SECRET}}(\text{targetUrl} + ":" + \text{timestamp} + ":" + \text{secret})$$
3. Injects headers:
   - `x-gateway-signature`: The computed SHA-256 hexadecimal signature.
   - `x-gateway-timestamp`: The current epoch timestamp in milliseconds.
   - `x-gateway-secret`: The shared symmetric secret.
4. **Anti-Replay Attack Protection**: If an attacker intercepts a signed request, it expires within $\pm 5$ minutes (300,000 ms). Downstream services reject any request with timestamp drift outside this window.

### D. JWT Identity & Role Claim Enrichment
When a frontend client includes `Authorization: Bearer <accessToken>`:
- The Gateway decodes the JWT payload.
- Injects internal trusted headers for downstream services:
  - `x-user-id`: Authenticated user UUID.
  - `x-employee-id`: Associated enterprise employee code.
  - `x-roles`: JSON array of user roles (e.g. `["EMPLOYEE", "HR_ADMIN"]`).
- Downstream microservices do not need to repeat JWT signature verification or database lookups.

### E. Unbuffered Server-Sent Events (SSE) Pass-Through
- Proxying persistent streaming connections like SSE (`text/event-stream`) requires explicit configuration.
- Buffering and response compression are disabled on `/api/v1/notifications/stream`.
- Chunks are flushed immediately to the client socket with zero latency.

### F. Global Gateway Health Check (`GET /health`)
- Independent health check endpoint reporting Gateway liveness, memory utilization, and uptime.

---

## 4. Step-by-Step Workflows ("How It Works")

### Workflow 1: End-to-End Request Proxy Lifecycle
```
Client (Web / Mobile)           API Gateway (8000)                Downstream Service (e.g. 3004)
        │                               │                                     │
        │ 1. POST /api/v1/employees     │                                     │
        │    Authorization: Bearer ...  │                                     │
        ├──────────────────────────────►│                                     │
        │                               │ 2. Check Throttler (Within limit?)  │
        │                               │ 3. Decode JWT Claims                │
        │                               │ 4. Compute HMAC-SHA256 Signature    │
        │                               │    url + timestamp + secret         │
        │                               │ 5. Forward request with headers:    │
        │                               │    - x-gateway-signature            │
        │                               │    - x-gateway-timestamp            │
        │                               │    - x-gateway-secret               │
        │                               │    - x-user-id                      │
        │                               │    - x-roles                        │
        │                               ├────────────────────────────────────►│
        │                               │                                     │ 6. Verify HMAC Signature
        │                               │                                     │ 7. Check Timestamp Drift
        │                               │                                     │ 8. Execute Business Logic
        │                               │ 9. 201 Created                      │
        │                               │◄────────────────────────────────────┤
        │ 10. 201 Created Response      │
        │◄──────────────────────────────┤
```

---

### Workflow 2: Anti-Brute-Force Rate Limiting Interception
1. Attacker fires 10 rapid login attempts to `POST http://localhost:8000/api/v1/auth/login`.
2. Requests 1 through 5 pass to `auth-service` (evaluating credentials).
3. Request 6 triggers `@nestjs/throttler` in `RateLimiterMiddleware`.
4. The Gateway **immediately cuts off the connection** with `HTTP 429 Too Many Requests`:
   ```json
   {
     "statusCode": 429,
     "message": "ThrottlerException: Too Many Requests"
   }
   ```
5. `auth-service` and the database receive zero traffic for requests 6–10, preventing CPU and database exhaustion.

---

## 5. Complete API Gateway Reference

All client calls target `http://localhost:8000/api/v1/...`:

```bash
# 1. Gateway Health Check
curl http://localhost:8000/health

# 2. Authentication Login (Rate limited: 5 req/min)
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "employee@company.com", "password": "Password123!"}'

# 3. Attendance Check-In (Enforces Face Token & Geofence)
curl -X POST http://localhost:8000/api/v1/attendance/check-in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{
    "officeId": "OFFICE-001",
    "location": { "latitude": 18.5204, "longitude": 73.8567, "accuracyMeters": 10, "isMocked": false },
    "faceVerificationToken": "<faceToken>",
    "clientEventId": "c1a2b3c4-0000-0000-0000-000000000001"
  }'

# 4. Geofence Location Verification
curl -X POST http://localhost:8000/api/v1/geofence/verify \
  -H "Content-Type: application/json" \
  -d '{"officeId": "OFFICE-001", "latitude": 18.5205, "longitude": 73.8565}'

# 5. List Employees
curl http://localhost:8000/api/v1/employees -H "Authorization: Bearer <accessToken>"

# 6. Stream Real-Time Notifications (SSE)
curl -N http://localhost:8000/api/v1/notifications/stream?recipientId=EMP-001 \
  -H "Accept: text/event-stream"
```

---

## 6. Environment Configuration Reference (`.env`)

| Variable | Description | Recommended / Example Value |
|---|---|---|
| `PORT` | Public port for API Gateway | `8000` |
| `NODE_ENV` | Runtime environment | `development` |
| `CORS_ORIGIN` | Allowed CORS origins for browser web apps | `http://localhost:3000,http://localhost:5173` |
| `AUTH_SERVICE_URL` | Internal URL for Auth Service | `http://localhost:3001` |
| `ATTENDANCE_SERVICE_URL`| Internal URL for Attendance Service | `http://localhost:3002` |
| `GEOFENCE_SERVICE_URL` | Internal URL for Geofence Service | `http://localhost:3003` |
| `EMPLOYEE_SERVICE_URL` | Internal URL for Employee Service | `http://localhost:3004` |
| `NOTIFICATION_SERVICE_URL`| Internal URL for Notification Service | `http://localhost:3005` |
| `FACE_SERVICE_URL` | Internal URL for Face AI Service | `http://localhost:3006` |
| `JWT_ACCESS_SECRET` | Secret used to decode and inspect bearer tokens | `your-secure-jwt-access-secret` |
| `GATEWAY_SHARED_SECRET`| Cryptographic secret used for HMAC-SHA256 signing | `your-internal-gateway-shared-secret` |

---

## 7. Local Setup & Verification

```bash
# 1. Install dependencies
cd backend/api-gateway
npm install

# 2. Build TypeScript distribution
npm run build

# 3. Start API Gateway in watch mode
npm run start:dev

# 4. Verify gateway is live
curl http://localhost:8000/health
```
