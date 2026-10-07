from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FaceProfile, FaceVerificationLog
from app.schemas import (
    FaceEnrollRequest,
    FaceEnrollResponse,
    ChallengeResponse,
    FaceVerifyRequest,
    FaceVerifyResponse,
    VerifyTokenRequest,
    VerifyTokenResponse,
    FaceStatusResponse,
    DetectNeutralRequest,
    DetectNeutralResponse,
    DetectActionRequest,
    DetectActionResponse,
)
from app.utils.image_processing import decode_base64_image, resize_if_needed
from app.services.face_engine import face_engine
from app.services.liveness_detector import liveness_detector
from app.services.challenge_service import challenge_service
from app.services.token_service import create_verification_token, verify_token
from app.services.crypto_service import biometric_crypto
from app.config import settings
import requests
import time

_id_cache: dict = {}

def resolve_employee_candidates(employee_id: str) -> list:
    if not employee_id:
        return []
    now = time.time()
    if employee_id in _id_cache:
        cached_ids, exp = _id_cache[employee_id]
        if exp > now:
            return cached_ids

    candidates = [employee_id]
    try:
        resp = requests.get(
            f"http://localhost:3004/api/v1/employees/{employee_id}",
            headers={"x-gateway-secret": settings.GATEWAY_SHARED_SECRET},
            timeout=2.0,
        )
        if resp.ok:
            data = resp.json()
            emp = data.get("data", data)
            if emp and isinstance(emp, dict):
                if emp.get("id"):
                    candidates.append(str(emp["id"]))
                if emp.get("employeeCode"):
                    candidates.append(str(emp["employeeCode"]))
                if emp.get("userId"):
                    candidates.append(str(emp["userId"]))
    except Exception:
        pass

    unique = list(dict.fromkeys(candidates))
    for cid in unique:
        _id_cache[cid] = (unique, now + 300)
    return unique

router = APIRouter(prefix="/face", tags=["Face AI"])

@router.get("/status/{employee_id}", response_model=FaceStatusResponse)
def get_face_status(employee_id: str, db: Session = Depends(get_db)):
    candidates = resolve_employee_candidates(employee_id)
    profile = db.query(FaceProfile).filter(FaceProfile.employee_id.in_(candidates), FaceProfile.is_active == True).first()
    if not profile:
        return FaceStatusResponse(
            employee_id=employee_id,
            is_enrolled=False,
            enrolled_at=None,
            last_verified_at=None,
        )
    return FaceStatusResponse(
        employee_id=employee_id,
        is_enrolled=True,
        enrolled_at=profile.enrolled_at,
        last_verified_at=profile.last_verified_at,
    )

@router.post("/enroll", response_model=FaceEnrollResponse)
def enroll_face(payload: FaceEnrollRequest, db: Session = Depends(get_db)):
    try:
        image = decode_base64_image(payload.image_base64)
        image = resize_if_needed(image)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid base64 image: {str(e)}"
        )

    # 1. Anti-spoofing check during enrollment
    is_live, liveness_score, liveness_msg = liveness_detector.check_passive_liveness(image)
    if not is_live:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Enrollment rejected: {liveness_msg}"
        )

    # 2. Extract 512-D face embedding
    embedding = face_engine.extract_embedding(image)
    if not embedding:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No clear face detected in the provided image. Please submit a well-lit frontal face photo."
        )

    # 3. Save or update face profile in database (AES-256-GCM encrypted at rest)
    encrypted_embedding = biometric_crypto.encrypt_embedding(embedding)
    existing_profile = db.query(FaceProfile).filter(FaceProfile.employee_id == payload.employee_id).first()
    if existing_profile:
        existing_profile.embedding = encrypted_embedding
        existing_profile.model_version = "SFace-128"
        existing_profile.enrolled_at = datetime.utcnow()
        existing_profile.is_active = True
    else:
        new_profile = FaceProfile(
            employee_id=payload.employee_id,
            embedding=encrypted_embedding,
            model_version="SFace-128",
            is_active=True,
        )
        db.add(new_profile)

    db.commit()
    return FaceEnrollResponse(
        success=True,
        employee_id=payload.employee_id,
        message="Face successfully enrolled and verified."
    )

@router.get("/challenge", response_model=ChallengeResponse)
def get_challenge(employee_id: str):
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id query parameter is required")
    challenge_data = challenge_service.create_challenge(employee_id)
    return ChallengeResponse(**challenge_data)

@router.post("/verify", response_model=FaceVerifyResponse)
def verify_face(payload: FaceVerifyRequest, db: Session = Depends(get_db)):
    # 1. Check if employee is enrolled
    candidates = resolve_employee_candidates(payload.employee_id)
    profile = db.query(FaceProfile).filter(
        FaceProfile.employee_id.in_(candidates),
        FaceProfile.is_active == True
    ).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee {payload.employee_id} has not enrolled their face. Face enrollment is mandatory."
        )

    # 2. Validate and consume active challenge
    challenge = challenge_service.validate_and_consume(payload.challenge_id, payload.employee_id, candidate_ids=candidates)
    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired challenge ID. Please request a new challenge before verifying."
        )

    # 3. Decode frame sequence
    frames = []
    try:
        for b64 in payload.frames:
            img = decode_base64_image(b64)
            img = resize_if_needed(img)
            frames.append(img)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode image frames: {str(e)}")

    # 4. Active Liveness & Anti-Spoofing check
    is_live, liveness_score, liveness_reason = liveness_detector.check_active_challenge(
        action=challenge["action"],
        frames=frames
    )

    if not is_live:
        # Log failed attempt
        log = FaceVerificationLog(
            face_profile_id=profile.id,
            employee_id=payload.employee_id,
            similarity_score=0.0,
            liveness_score=liveness_score,
            challenge_type=challenge["action"],
            is_match=False,
            is_live=False,
            rejection_reason=liveness_reason,
        )
        db.add(log)
        db.commit()
        
        return FaceVerifyResponse(
            verified=False,
            confidence=0.0,
            is_live=False,
            verification_token=None,
            message=f"Liveness challenge failed: {liveness_reason}"
        )

    # 5. Extract embedding from live frame (the best frontal frame)
    live_embedding = face_engine.extract_embedding(frames[-1])
    if not live_embedding and len(frames) > 1:
        live_embedding = face_engine.extract_embedding(frames[0])

    if not live_embedding:
        return FaceVerifyResponse(
            verified=False,
            confidence=0.0,
            is_live=True,
            verification_token=None,
            message="Face could not be clearly located in live frame"
        )

    # 6. Decrypt stored embedding and compute Cosine Similarity
    stored_embedding = biometric_crypto.decrypt_embedding(profile.embedding)
    if len(stored_embedding) != 128:
        return FaceVerifyResponse(
            verified=False,
            confidence=0.0,
            is_live=True,
            verification_token=None,
            message="Your face profile needs updating. Please tap 'Re-register Face' to update biometrics."
        )

    similarity = face_engine.compute_similarity(stored_embedding, live_embedding)
    is_match = similarity >= settings.FACE_SIMILARITY_THRESHOLD

    # 7. Create log
    log = FaceVerificationLog(
        face_profile_id=profile.id,
        employee_id=payload.employee_id,
        similarity_score=similarity,
        liveness_score=liveness_score,
        challenge_type=challenge["action"],
        is_match=is_match,
        is_live=True,
        rejection_reason=None if is_match else f"Similarity {similarity:.2f} below required {settings.FACE_SIMILARITY_THRESHOLD:.2f}",
    )
    db.add(log)

    if is_match:
        profile.last_verified_at = datetime.utcnow()
        db.commit()
        
        # Issue cryptographically signed verification token
        token = create_verification_token(payload.employee_id, similarity)
        return FaceVerifyResponse(
            verified=True,
            confidence=round(similarity, 4),
            is_live=True,
            verification_token=token,
            message="Face verification and liveness check passed."
        )
    else:
        db.commit()
        return FaceVerifyResponse(
            verified=False,
            confidence=round(similarity, 4),
            is_live=True,
            verification_token=None,
            message=f"Face mismatch. Similarity {similarity:.2f} is below threshold {settings.FACE_SIMILARITY_THRESHOLD:.2f}"
        )

@router.post("/verify-token", response_model=VerifyTokenResponse)
def check_verification_token(payload: VerifyTokenRequest):
    """
    Internal service endpoint called by attendance-service to confirm
    the employee has a fresh, valid face verification token before check-in.
    """
    candidates = resolve_employee_candidates(payload.employee_id)
    is_valid = False
    confidence = 0.0
    msg = "Token verification failed"
    for cid in candidates:
        v, c, m = verify_token(payload.verification_token, cid)
        if v:
            is_valid, confidence, msg = v, c, m
            break
    return VerifyTokenResponse(
        valid=is_valid,
        employee_id=payload.employee_id,
        confidence=confidence,
        message=msg
    )

@router.post("/detect-neutral", response_model=DetectNeutralResponse)
def detect_neutral_pose(payload: DetectNeutralRequest):
    """
    Real-time continuous preview endpoint:
    Checks if a centered, frontal, looking-straight face is aligned in the oval.
    """
    try:
        img = decode_base64_image(payload.current_frame)
        img = resize_if_needed(img)
    except Exception:
        return DetectNeutralResponse(detected=False, message="Invalid image frame")

    face = face_engine.detect_face(img)
    if face is None:
        return DetectNeutralResponse(detected=False, message="Position face inside oval guide")

    # Landmarks: [x, y, w, h, re_x, re_y, le_x, le_y, nt_x, nt_y, rcm_x, rcm_y, lcm_x, lcm_y, score]
    re_x, le_x = face[4], face[6]
    nt_x = face[8]
    eye_span = max(float(abs(le_x - re_x)), 1.0)
    yaw = (nt_x - min(re_x, le_x)) / eye_span

    # Check centered frontal face (yaw roughly 0.40 to 0.60)
    if 0.38 <= yaw <= 0.62:
        return DetectNeutralResponse(detected=True, message="Neutral frontal face detected")
    else:
        return DetectNeutralResponse(detected=False, message="Please face directly towards camera")

@router.post("/detect-action", response_model=DetectActionResponse)
def detect_live_action(payload: DetectActionRequest):
    """
    Real-time continuous action detector:
    Evaluates whether the user is performing the requested micro-action
    (TURN_LEFT, TURN_RIGHT, SMILE, BLINK) relative to the neutral reference photo.
    Returns detected: True the millisecond the action is verified.
    """
    try:
        neutral_img = decode_base64_image(payload.neutral_frame)
        neutral_img = resize_if_needed(neutral_img)
        current_img = decode_base64_image(payload.current_frame)
        current_img = resize_if_needed(current_img)
    except Exception as e:
        return DetectActionResponse(detected=False, action=payload.action, confidence=0.0, message="Invalid frame payload")

    is_live, score, reason = liveness_detector.check_active_challenge(
        action=payload.action,
        frames=[neutral_img, current_img]
    )

    return DetectActionResponse(
        detected=is_live,
        action=payload.action,
        confidence=score,
        message=reason
    )
