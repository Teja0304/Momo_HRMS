# In-App Notification Microservice (`notification-service`)

> **Momo HRMS — Real-Time Server-Sent Events (SSE) Streaming & Notification Persistence Engine**  
> Delivers instantaneous in-app alerts, push streaming, and read-receipt persistence across web and mobile clients for check-in confirmations, geofence boundary warnings, HR exception decisions, and administrative announcements.

---

## 1. Executive Summary & Purpose

The **Notification Service** is the real-time communication pipeline for the **Smart Employee Attendance & Management System (Momo HRMS)**.

In an active workforce management platform, asynchronous event feedback is critical:
- *Did my face verification and check-in successfully register?*
- *I walked out of the building — how much time is left on my grace period before auto-checkout?*
- *Did HR approve my remote / client-site exception request?*

The Notification Service provides both:
1. **Durable Persistence**: All notifications are recorded in MySQL (`notification_db`) with read/unread tracking and historical retrieval.
2. **Real-Time Streaming**: Directly streams live alerts to connected mobile and web clients via **Server-Sent Events (SSE)** without polling.

---

## 2. Microservice Boundaries & Architectural Principles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MOMO HRMS ECOSYSTEM                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                      ┌────────────────┴────────────────┐
                      │                                 │
                      ▼                                 ▼
             Attendance Service                  HR / Admin Portal
                (Port 3002)                         (Port 8000)
                      │                                 │
       - Check-in verified                              - Exception approved
       - Geofence exit warning                          - Policy change
                      │                                 │
                      └────────────────┬────────────────┘
                                       │
                                       ▼ (Internal POST /notifications/send)
                        Notification Service (Port 3005)
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 │                                           │
                 ▼                                           ▼
      [1. MySQL Persistence]                       [2. RxJS SSE Stream]
      - Saves to notifications table               - Broadcasts to active connections
      - recipientId, type, title, body             - Filters by recipientId
      - isRead = false                             - Zero message drop
                 │                                           │
                 └─────────────────────┬─────────────────────┘
                                       │
                                       ▼ HTTP/1.1 or HTTP/2 SSE Stream
                             React Web / Mobile App
                              (Real-time Bell Icon)
```

### Why Server-Sent Events (SSE) Instead of WebSockets or Redis?
In an enterprise attendance system, notifications are **unidirectional** (the server pushes alerts down to the employee's client):
- **WebSockets Overhead**: WebSockets require full-duplex bi-directional framing, custom ping/pong heartbeats, and complex state management on mobile OS background threads.
- **SSE Simplicity & Reliability**: SSE runs over standard HTTP (`text/event-stream`), natively supported by browser `EventSource`. If an employee loses signal in an elevator or basement, **the browser automatically reconnects and handles backoff with zero custom client code**.
- **Lightweight In-Process Pub/Sub**: Built using an RxJS `Subject` observable pipeline. Eliminates the operational overhead of running external message brokers (Redis/RabbitMQ/Kafka) for local single-cluster deployments.

---

## 3. What is Implemented in This Microservice

### A. Real-Time SSE Streaming Pipeline (`/notifications/stream`)
- Implemented in `NotificationController.streamNotifications`:
  ```typescript
  @Sse('stream')
  streamNotifications(@Query('recipientId') recipientId: string): Observable<MessageEvent>
  ```
- Subscribes to the central RxJS `Subject<Notification>()`.
- Employs the `filter()` operator so each connected client receives only notifications specifically matching their `recipientId` (or global system broadcasts).
- Sends periodic heartbeat pings (`:keepalive\n\n`) to prevent aggressive firewall and proxy connection timeouts.

### B. Durable MySQL Persistence & State Tracking
- Every notification is persisted in `notifications`:
  - `isRead`: Boolean status flag.
  - `readAt`: Timestamp when the user opened or dismissed the alert.
  - `metadata`: JSON payload carrying contextual IDs (e.g. `officeId`, `sessionId`, `exceptionId`) for deep-linking in mobile navigation.

### C. Unread Badge Counter Optimization
- `GET /api/v1/notifications/unread-count?recipientId=...` runs a fast indexed SQL count query (`WHERE recipient_id = ? AND is_read = false`), powering high-performance notification bell badges in frontend header bars.

### D. Security & Gateway Integration
- All internal notification dispatches (`POST /notifications/send`) require the `x-gateway-secret` header or valid HMAC signature.
- Public client streaming endpoints (`GET /notifications/stream`) pass through the API Gateway, maintaining continuous open streaming channels.

---

## 4. Notification Catalog & Business Payloads

| Notification Type | Triggering Microservice | Priority | User-Facing Message |
|---|---|---|---|
| `CHECKIN_CONFIRMATION` | `attendance-service` | Normal | *"Check-in confirmed at Pune HQ at 09:15 AM."* |
| `CHECKOUT_CONFIRMATION` | `attendance-service` | Normal | *"Checked out successfully. Total working time: 8h 15m."* |
| `GEOFENCE_EXIT_WARNING` | `attendance-service` | **High** | *"You stepped outside the office geofence. Your session is paused. Return within 60 minutes to resume."* |
| `GEOFENCE_RETURN` | `attendance-service` | Normal | *"Welcome back! Your attendance session has resumed."* |
| `EXCEPTION_APPROVED` | `attendance-service` / HR | **High** | *"Your Client-Site attendance exception for today has been approved."* |
| `EXCEPTION_REJECTED` | `attendance-service` / HR | **High** | *"Your attendance exception request was rejected by HR."* |
| `SYSTEM_ALERT` | System Administrator | Normal | *"System maintenance scheduled for Saturday 02:00 AM UTC."* |

---

## 5. Client Integration Code Examples

### Web Frontend (React with `EventSource`):
```tsx
import React, { useEffect, useState } from 'react';

export function NotificationBell({ employeeId }: { employeeId: string }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // 1. Fetch initial unread count
    fetch(`http://localhost:8000/api/v1/notifications/unread-count?recipientId=${employeeId}`)
      .then(res => res.json())
      .then(data => setUnreadCount(data.data.count));

    // 2. Open real-time SSE stream through API Gateway
    const sse = new EventSource(
      `http://localhost:8000/api/v1/notifications/stream?recipientId=${employeeId}`
    );

    sse.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      console.log('New live notification:', notification.title);
      setUnreadCount(prev => prev + 1);
      // Display toast or play sound
    };

    sse.onerror = (err) => {
      console.warn('SSE connection interrupted, browser reconnecting automatically...');
    };

    return () => sse.close();
  }, [employeeId]);

  return (
    <div className="notification-bell">
      <span className="icon">🔔</span>
      {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
    </div>
  );
}
```

---

## 6. Database Schema & Data Models (`prisma/schema.prisma`)

```
┌────────────────────────────────────────────────────────────────────────┐
│                             notifications                              │
├────────────────────────────────────────────────────────────────────────┤
│ id: String (UUID, PK)                                                  │
│ recipient_id: String(64) (e.g. "EMP-001" or userId)                   │
│ recipient_type: ENUM ('EMPLOYEE', 'ADMIN', 'ALL')                      │
│ type: ENUM ('CHECKIN_CONFIRMATION', 'CHECKOUT_CONFIRMATION',           │
│             'GEOFENCE_EXIT_WARNING', 'GEOFENCE_RETURN',                 │
│             'EXCEPTION_APPROVED', 'EXCEPTION_REJECTED', 'SYSTEM_ALERT')│
│ title: String(128)                                                     │
│ body: Text                                                             │
│ metadata: JSON? (Contextual IDs, deep-links, coordinates)              │
│ is_read: Boolean (Default: false)                                      │
│ read_at: DateTime?                                                     │
│ created_at: DateTime (Default: now())                                  │
│ updated_at: DateTime                                                   │
└────────────────────────────────────────────────────────────────────────┘
```

### Table Indexing Strategy:
- `INDEX (recipient_id, is_read)`: Powers instant unread counts and badge queries.
- `INDEX (created_at)`: Optimizes reverse-chronological pagination.

---

## 7. Complete REST API Reference

All routes are prefixed with `/api/v1` and accessible via the API Gateway at `http://localhost:8000/api/v1/...`.

### 1. Send Notification (Internal Service API)
- **Method**: `POST /api/v1/notifications/send`
- **Request Body**:
```json
{
  "recipientId": "EMP-001",
  "recipientType": "EMPLOYEE",
  "type": "CHECKIN_CONFIRMATION",
  "title": "Check-In Verified",
  "body": "Morning session recorded successfully within Pune HQ polygon.",
  "metadata": {
    "officeId": "OFFICE-001",
    "sessionId": "s1a2b3c4-0000-0000-0000-000000000001"
  }
}
```
- **Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "id": "n1a2b3c4-0000-0000-0000-000000000001",
    "recipientId": "EMP-001",
    "type": "CHECKIN_CONFIRMATION",
    "title": "Check-In Verified",
    "body": "Morning session recorded successfully within Pune HQ polygon.",
    "isRead": false,
    "createdAt": "2026-09-29T09:00:00.000Z"
  }
}
```

---

### 2. Stream Real-Time Notifications (SSE)
- **Method**: `GET /api/v1/notifications/stream?recipientId=EMP-001`
- **Headers**: `Accept: text/event-stream`
- **Payload**: Long-lived stream pushing JSON frames:
```
data: {"id":"n1a2b3c4...","title":"Check-In Verified","body":"..."}\n\n
```

---

### 3. List Notifications (Paginated)
- **Method**: `GET /api/v1/notifications?recipientId=EMP-001&page=1&limit=20`
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "n1a2b3c4-0000-0000-0000-000000000001",
        "title": "Check-In Verified",
        "body": "Morning session recorded successfully.",
        "isRead": false,
        "createdAt": "2026-09-29T09:00:00.000Z"
      }
    ],
    "total": 1,
    "unreadCount": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### 4. Get Unread Count
- **Method**: `GET /api/v1/notifications/unread-count?recipientId=EMP-001`
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "count": 1
  }
}
```

---

### 5. Mark Notification as Read
- **Method**: `PATCH /api/v1/notifications/:id/read`
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "n1a2b3c4-0000-0000-0000-000000000001",
    "isRead": true,
    "readAt": "2026-09-29T09:05:00.000Z"
  }
}
```

---

### 6. Mark All as Read
- **Method**: `POST /api/v1/notifications/read-all?recipientId=EMP-001`
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "updated": 5
  }
}
```

---

## 8. Environment Configuration Reference (`.env`)

| Variable | Description | Recommended / Example Value |
|---|---|---|
| `PORT` | Local HTTP port | `3005` |
| `DATABASE_URL` | MySQL connection string (sanitized) | `mysql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:3306/notification_db` |
| `GATEWAY_SHARED_SECRET` | Secret for HMAC signature and gateway header | `your-internal-gateway-shared-secret` |

---

## 9. Local Setup & Testing

```bash
# 1. Install dependencies
cd backend/notification-service
npm install

# 2. Run Prisma migrations
npm run prisma:generate
npm run prisma:migrate:dev --name init

# 3. Seed demo welcome notifications
npm run prisma:seed

# 4. Start development server
npm run start:dev
```
