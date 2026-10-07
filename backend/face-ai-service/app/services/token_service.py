import time
from typing import Optional, Tuple
from jose import jwt, JWTError
from app.config import settings

def create_verification_token(employee_id: str, confidence: float) -> str:
    now = int(time.time())
    payload = {
        "sub": employee_id,
        "type": "FACE_VERIFICATION",
        "confidence": round(confidence, 4),
        "iat": now,
        "exp": now + settings.VERIFICATION_TOKEN_TTL_SECONDS,
    }
    return jwt.encode(payload, settings.FACE_JWT_SECRET, algorithm="HS256")

def verify_token(token: str, expected_employee_id: str) -> Tuple[bool, float, str]:
    try:
        payload = jwt.decode(token, settings.FACE_JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "FACE_VERIFICATION":
            return False, 0.0, "Invalid token type"
            
        employee_id = payload.get("sub")
        if employee_id != expected_employee_id:
            return False, 0.0, f"Token employee mismatch (expected {expected_employee_id}, found {employee_id})"
            
        confidence = float(payload.get("confidence", 0.0))
        return True, confidence, "Token verified successfully"
    except JWTError as e:
        return False, 0.0, f"Token invalid or expired: {str(e)}"
