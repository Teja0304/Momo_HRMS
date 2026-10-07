# Face AI & Biometrics Microservice (`face-ai-service`)

> **Momo HRMS — Computer Vision Biometrics, Active Challenge-Response Liveness & Anti-Spoofing Engine**  
> Built with Python 3.12, FastAPI, and OpenCV. Enforces mandatory biometric verification for attendance, active interactive challenges (Blink, Turn Left, Turn Right, Smile), 2D FFT Moire screen texture anti-spoofing, deep SFace (MobileFaceNet + ArcFace) neural embeddings, and AES-256-GCM vector encryption at rest.

---

## 1. Executive Summary & Problem Solved

The **Face AI Service** is the biometric authentication and presentation attack detection (anti-spoofing) engine for the **Smart Employee Attendance & Management System (Momo HRMS)**.

In enterprise attendance tracking, mobile and geofenced applications face two catastrophic attack vectors:
1. **Buddy Punching / Proxy Attendance**: An employee hands their smartphone or credentials to a colleague, who clocks in on their behalf.
2. **Presentation Attacks (Spoofing)**: A fraudster holds up a printed paper photo, a smartphone showing a photograph, or a looping video replay of the employee in front of the camera.

The Face AI Service eliminates both threats through a dual-defense architecture:
- **Active Challenge-Response Liveness Detection**: The server issues a dynamic micro-action challenge (`TURN_LEFT`, `TURN_RIGHT`, `SMILE`, or `BLINK`) that must be completed across a 3-frame sequence.
- **Deep Metric Learning Recognition**: Employs OpenCV's **YuNet** for 5-point facial landmark geometry and **SFace** (MobileFaceNet trained with ArcFace loss) to extract 128-dimensional unit embeddings, accurately discriminating between different human faces while rejecting unauthorized individuals.

---

## 2. Microservice Boundaries & System Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MOMO HRMS BIOMETRIC FLOW                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                             API GATEWAY (Port 8000)
                     (Body Limit: 50MB, Proxies /api/v1/face/*)
                                       │
                                       ▼
                          Face AI Service (Port 3006)
                                       │
       ┌───────────────────────────────┴───────────────────────────────┐
       │                                                               │
       ▼                                                               ▼
[Phase 1: Active Liveness & Anti-Spoof]                     [Phase 2: Deep Metric Verification]
- Server generates random action                            - YuNet detects face & 5 landmarks:
  (BLINK, SMILE, TURN_LEFT, TURN_RIGHT)                       (left eye, right eye, nose, mouth corners)
- Dynamic challenge with 180s TTL                           - Affine alignment to canonical 112x112
- Passive 2D FFT Moire & screen artifact check              - SFace extracts 128-D L2 unit embedding
- Geometric kinematic validation:                           - Decrypts enrolled vector (AES-256-GCM)
  * Yaw rotation ratio for Head Turns                       - SFace Cosine Similarity >= 0.40
  * Inter-commissural expansion for Smile                   - Cross-frame identity consistency
  * Eye patch edge aperture for Blink
       │                                                               │
       └───────────────────────────────┬───────────────────────────────┘
                                       │
                                       ▼
                       Issues Signed Verification Token
                           (Valid for 5 Minutes / 300s)
                                       │
                                       ▼
                           Attendance Service (3002)
                   "Token valid for EMP-001? -> Check-in Approved"
```

### Domain Boundary & Zero-Trust Principles:
- **What This Service OWNS**: Face profiles, AES-256-GCM encrypted 128-D facial embeddings, active challenge queues, liveness kinematic evaluation, frequency-domain anti-spoofing, and biometric verification tokens.
- **What This Service DOES NOT OWN**:
  - Raw facial photographs: Under strict privacy standards (GDPR / ISO/IEC 30107), **raw user photos are processed in memory and never written to disk or the database**.
  - Attendance timestamps, pauses, and working time (owned by `attendance-service`).
  - Office GPS polygons (owned by `geofence-service`).
  - User accounts and login credentials (owned by `auth-service`).

---

## 3. Computer Vision & Neural Architecture

### A. Deep Face Recognition: YuNet + SFace (ArcFace Loss)
Earlier versions utilized discrete cosine transform (DCT) frequency approximations, which shared high baseline similarity across different faces. The current production engine utilizes a two-stage deep learning pipeline:

1. **Face Detection & Landmark Estimation (YuNet)**:
   - **Model**: `face_detection_yunet_2023mar.onnx`
   - Detects the primary face and extracts 5 critical landmarks:
     - Right Eye $(x_{re}, y_{re})$
     - Left Eye $(x_{le}, y_{le})$
     - Nose Tip $(x_{nt}, y_{nt})$
     - Right Mouth Corner $(x_{rcm}, y_{rcm})$
     - Left Mouth Corner $(x_{lcm}, y_{lcm})$
   - Normalizes the face against roll rotation and scale.
2. **Deep Embedding Extraction (SFace)**:
   - **Model**: `face_recognition_sface_2021dec.onnx`
   - MobileFaceNet architecture trained with ArcFace (Additive Angular Margin Loss).
   - Generates a **128-dimensional unit floating-point embedding** $\mathbf{e} \in \mathbb{R}^{128}$ such that $\|\mathbf{e}\|_2 = 1.0$.
3. **Similarity Metric & Threshold**:
   - Compares the live embedding $\mathbf{u}$ and stored embedding $\mathbf{v}$ via Cosine Similarity:
     $$\text{Similarity}(\mathbf{u}, \mathbf{v}) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2}$$
   - **Decision Threshold**: `FACE_SIMILARITY_THRESHOLD = 0.40`.
   - **Discrimination Profile**:
     - Same person (genuine match): Cosine Similarity typically ranges between `0.55` and `0.92`.
     - Different person (impostor attempt): Cosine Similarity typically ranges between `-0.15` and `0.25`. Impostor attempts fail completely.

---

### B. Active Challenge-Response Liveness Detection

To prevent spoofing with printed photographs, videos, or 3D masks, every check-in requires a 3-frame active challenge:
1. `GET /api/v1/face/challenge?employee_id=<ID>` returns a random action with a unique `challenge_id` (180s TTL).
2. The user captures 3 frames:
   - **Frame 1**: Neutral expression, facing directly forward.
   - **Frame 2**: Performing the requested challenge action.
   - **Frame 3**: Confirming expression and 3D depth hold.
3. The server computes geometric landmark kinematics:
   - **`TURN_LEFT` / `TURN_RIGHT` (Head Yaw Rotation)**:
     - Computes the horizontal nose position relative to the eye centers:
       $$\text{Yaw} = \frac{x_{nt} - \min(x_{re}, x_{le})}{|x_{le} - x_{re}|}$$
     - A neutral frontal face yields $\text{Yaw} \approx 0.50$.
     - When turning left or right, $|\Delta \text{Yaw}| \ge 0.08$. If the user does not turn, the check fails with: `"Head turn not detected. Please visibly turn your head to the side when prompted."`
   - **`SMILE`**:
     - Computes normalized inter-commissural mouth width relative to inter-ocular distance:
       $$\text{Ratio} = \frac{\|(x_{rcm}, y_{rcm}) - (x_{lcm}, y_{lcm})\|_2}{|x_{le} - x_{re}|}$$
     - Requires $\ge 7\%$ expansion in Frame 2 or positive activation from the smile cascade classifier.
   - **`BLINK`**:
     - Extracts local normalized patches around $(x_{re}, y_{re})$ and $(x_{le}, y_{le})$.
     - Detects eyelid closure and aperture variance ($\Delta \ge 11.0$ grayscale difference).
   - **Cross-Frame Identity Guard**:
     - Asserts $\text{Similarity}(\text{Frame}_1, \text{Frame}_2) \ge 0.30$ to confirm that the person who performed the action is the same person as in Frame 1.

---

### C. Passive Presentation Attack Detection (Moire & Blur)

Before biometric matching, frames pass through frequency-domain anti-spoofing filters:
1. **2D FFT Moire Screen Grid Analysis**:
   - Digital screens (phones, monitors) emit periodic pixel grid interference patterns.
   - 2D Fast Fourier Transform ($\text{FFT2D}$) shifts the DC component to the center and measures high-frequency spectral spikes.
   - If periodic high-frequency power exceeds threshold and saturation variance is low, the request is rejected as `SCREEN_REPLAY_ATTACK`.
2. **Laplacian Blur Rejection**:
   - Evaluates $\text{Var}(\nabla^2 I)$. Rejects out-of-focus or motion-blurred inputs ($\text{Var} < 15.0$).

---

### D. Biometric Template Security (AES-256-GCM at Rest)

Biometric data is protected under zero-trust privacy controls:
- **No Images Stored**: Raw facial photographs are never persisted to disk or database.
- **AES-256-GCM Encryption**: Stored embeddings in `face_profiles.embedding` are encrypted with AES-256-GCM using:
  - 256-bit key derived from `FACE_JWT_SECRET` / `FACE_ENCRYPTION_KEY`.
  - Cryptographically random 96-bit initialization vector (nonce) per write.
  - 128-bit authentication tag to prevent ciphertext tampering.

---

## 4. Mobile User Experience (Automated Hands-Free Capture & Geofence Pre-Check)

In [frontend/mobile/src/screens/EmployeeHomeScreen.tsx](file:///home/angad/Momo%20HRMS/frontend/mobile/src/screens/EmployeeHomeScreen.tsx), biometric verification is completely hands-free and automated:

### Zero-Click Automated Flow:
1. **Pre-Flight Location & Geofence Verification**:
   - Tapping **Check In** *first* queries device GPS coordinates and contacts the Geofence Microservice (`POST /geofence/verify`).
   - If the employee is outside their assigned office boundary, check-in halts immediately with an alert showing their distance from the perimeter.
   - The camera and face verification modal **will only open if the employee is confirmed inside their office boundary**.
2. **Photo 1 (Neutral Face Auto-Snap)**:
   - Camera opens with an oval guide.
   - Background preview loop (420ms interval) streams frames to `POST /api/v1/face/detect-neutral`.
   - When a frontal, centered neutral face is detected (`0.38 <= yaw <= 0.62`), the shutter flashes and photo 1 is saved automatically without touching any button.
3. **Photo 2 (Action Auto-Snap)**:
   - Challenge card pulses with the required activity (`👈 TURN LEFT`, `👉 TURN RIGHT`, `😊 SMILE`, or `👁️ BLINK`).
   - Background preview loop sends frames to `POST /api/v1/face/detect-action`.
   - As soon as the kinematic threshold is crossed (e.g. head turns $\ge 8\%$, smile expands $\ge 7\%$, eyes blink $\Delta \ge 11$), the shutter flashes and photo 2 is captured automatically.
4. **Photo 3 (Hold & Auto-Submit)**:
   - Brief 450ms hold captures the final confirmation frame, and submits the 3-frame sequence to `POST /api/v1/face/verify`.
   - Upon verification, a signed verification token is issued and check-in completes automatically.

---

## 5. API Reference & Contract

### 1. `GET /api/v1/face/status/{employee_id}`
Checks if an employee has enrolled their biometrics.
- **Response**:
```json
{
  "employee_id": "611ae067-9b6c-4486-ae24-a55b402de311",
  "is_enrolled": true,
  "enrolled_at": "2026-09-30T11:51:05",
  "last_verified_at": "2026-09-30T12:05:00"
}
```

### 2. `POST /api/v1/face/enroll`
Registers an employee's face biometrics.
- **Request**:
```json
{
  "employee_id": "611ae067-9b6c-4486-ae24-a55b402de311",
  "image_base64": "<base64 JPEG/PNG>"
}
```
- **Response**:
```json
{
  "success": true,
  "employee_id": "611ae067-9b6c-4486-ae24-a55b402de311",
  "message": "Face successfully enrolled and verified."
}
```

### 3. `GET /api/v1/face/challenge`
Generates a dynamic 3-frame liveness action.
- **Query Params**: `employee_id=<ID>`
- **Response**:
```json
{
  "challenge_id": "3f82a1b4-4b51-409c-a2b1-6a2d9e0f314c",
  "employee_id": "611ae067-9b6c-4486-ae24-a55b402de311",
  "action": "TURN_RIGHT",
  "instruction": "Turn your head to the right",
  "expires_in_seconds": 180
}
```

### 4. `POST /api/v1/face/detect-neutral`
Real-time continuous preview endpoint for hands-free Photo 1 capture.
- **Request**:
```json
{
  "current_frame": "<base64 preview JPEG>"
}
```
- **Response**:
```json
{
  "detected": true,
  "message": "Neutral frontal face detected"
}
```

### 5. `POST /api/v1/face/detect-action`
Real-time continuous activity detector for hands-free Photo 2 capture.
- **Request**:
```json
{
  "action": "TURN_RIGHT",
  "neutral_frame": "<base64 Photo 1>",
  "current_frame": "<base64 preview JPEG>"
}
```
- **Response**:
```json
{
  "detected": true,
  "action": "TURN_RIGHT",
  "confidence": 0.94,
  "message": "TURN_RIGHT motion successfully verified"
}
```

### 6. `POST /api/v1/face/verify`
Submits the 3-frame sequence for liveness check and face matching.
- **Request**:
```json
{
  "employee_id": "611ae067-9b6c-4486-ae24-a55b402de311",
  "challenge_id": "3f82a1b4-4b51-409c-a2b1-6a2d9e0f314c",
  "frames": [
    "<base64 frame 1 (neutral)>",
    "<base64 frame 2 (action)>",
    "<base64 frame 3 (hold)>"
  ]
}
```
- **Success Response (HTTP 200)**:
```json
{
  "verified": true,
  "confidence": 0.8412,
  "is_live": true,
  "verification_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Face verification and liveness check passed."
}
```
- **Failure Response (HTTP 200)**:
```json
{
  "verified": false,
  "confidence": 0.1245,
  "is_live": false,
  "verification_token": null,
  "message": "Head turn not detected. Please visibly turn your head to the side when prompted."
}
```

### 7. `POST /api/v1/face/verify-token`
Internal endpoint called by `attendance-service` to validate a token before check-in.
- **Request**:
```json
{
  "verification_token": "<JWT token>",
  "employee_id": "611ae067-9b6c-4486-ae24-a55b402de311"
}
```
- **Response**:
```json
{
  "valid": true,
  "employee_id": "611ae067-9b6c-4486-ae24-a55b402de311",
  "confidence": 0.8412,
  "message": "Verification token is valid"
}
```

---

## 6. Directory Structure & File Manifest

```
backend/face-ai-service/
├── app/
│   ├── config.py                 # Service settings (thresholds, DB URL, JWT secrets)
│   ├── database.py               # SQLAlchemy engine and session factory
│   ├── main.py                   # FastAPI initialization & router inclusion
│   ├── models.py                 # FaceProfile, FaceVerificationLog tables
│   ├── schemas.py                # Pydantic request/response models
│   ├── weights/                  # Deep learning ONNX model weights
│   │   ├── face_detection_yunet_2023mar.onnx     # YuNet 5-landmark face detector
│   │   └── face_recognition_sface_2021dec.onnx   # SFace ArcFace 128-D extractor
│   ├── routers/
│   │   ├── face.py               # Biometric enroll, challenge, verify endpoints
│   │   └── health.py             # Service & DB health check
│   ├── services/
│   │   ├── challenge_service.py  # In-memory challenge queue & TTL tracker
│   │   ├── crypto_service.py     # AES-256-GCM biometric vector encryption
│   │   ├── face_engine.py        # YuNet + SFace embedding extraction & similarity
│   │   ├── liveness_detector.py  # Kinematic yaw/smile/blink & Moire detection
│   │   └── token_service.py      # HMAC-SHA256 verification token issuer/validator
│   └── utils/
│       └── image_processing.py   # Base64 decoding, format validation, resizing
├── venv/                         # Python 3.12 virtual environment
├── requirements.txt              # Dependencies (fastapi, opencv-python-headless, etc.)
├── .env                          # Local environment variables
└── README.md                     # Microservice architectural documentation
```

---

## 7. Configuration Reference (`.env`)

| Variable | Default | Description |
|:---|:---|:---|
| `PORT` | `3006` | HTTP service port |
| `DATABASE_URL` | `mysql+pymysql://admin:Admin123@localhost:3306/face_ai_db` | MySQL connection string |
| `FACE_SIMILARITY_THRESHOLD` | `0.40` | SFace Cosine similarity match threshold |
| `LIVENESS_CONFIDENCE_THRESHOLD` | `0.80` | Minimum score for passive anti-spoofing |
| `CHALLENGE_TIMEOUT_SECONDS` | `180` | Challenge expiration window (seconds) |
| `VERIFICATION_TOKEN_TTL_SECONDS` | `300` | Issued check-in token validity (5 mins) |
| `FACE_JWT_SECRET` | `dev-face-secret-key-change-in-prod` | Signing secret for verification tokens |
| `GATEWAY_SHARED_SECRET` | `dev-gateway-secret` | Shared secret with API gateway |

---

## 8. Running & Testing Locally

```bash
# 1. Activate virtual environment
cd "backend/face-ai-service"
source venv/bin/activate

# 2. Verify model weights exist
ls -lh app/weights/

# 3. Start development server
uvicorn app.main:app --host 0.0.0.0 --port 3006 --reload

# 4. Check service health
curl http://localhost:3006/health
# Output: {"status":"healthy","service":"face-ai-service","database":"up"}
```
