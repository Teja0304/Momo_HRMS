from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

class FaceEnrollRequest(BaseModel):
    employee_id: str = Field(..., description="Unique employee identifier")
    image_base64: str = Field(..., description="Base64 encoded JPEG/PNG face image")

class FaceEnrollResponse(BaseModel):
    success: bool
    employee_id: str
    message: str

class ChallengeResponse(BaseModel):
    challenge_id: str
    employee_id: str
    action: str
    instruction: str
    expires_in_seconds: int

class FaceVerifyRequest(BaseModel):
    employee_id: str = Field(..., description="Unique employee identifier")
    challenge_id: str = Field(..., description="Active challenge ID issued by /challenge endpoint")
    frames: List[str] = Field(..., min_length=1, max_length=5, description="1 to 5 base64 encoded image frames representing the action challenge")

class FaceVerifyResponse(BaseModel):
    verified: bool
    confidence: float
    is_live: bool
    verification_token: Optional[str] = None
    message: str

class VerifyTokenRequest(BaseModel):
    employee_id: str
    verification_token: str

class VerifyTokenResponse(BaseModel):
    valid: bool
    employee_id: str
    confidence: float
    message: str

class FaceStatusResponse(BaseModel):
    employee_id: str
    is_enrolled: bool
    enrolled_at: Optional[datetime] = None
    last_verified_at: Optional[datetime] = None

class DetectNeutralRequest(BaseModel):
    current_frame: str

class DetectNeutralResponse(BaseModel):
    detected: bool
    message: str

class DetectActionRequest(BaseModel):
    action: str
    neutral_frame: str
    current_frame: str

class DetectActionResponse(BaseModel):
    detected: bool
    action: str
    confidence: float
    message: str

