import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Float, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class FaceProfile(Base):
    __tablename__ = "face_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column(String(64), unique=True, nullable=False, index=True)
    embedding = Column(JSON, nullable=False)
    model_version = Column(String(32), default="ArcFace-512", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    enrolled_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_verified_at = Column(DateTime, nullable=True)

    logs = relationship("FaceVerificationLog", back_populates="profile", cascade="all, delete-orphan")

class FaceVerificationLog(Base):
    __tablename__ = "face_verification_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    face_profile_id = Column(String(36), ForeignKey("face_profiles.id", ondelete="CASCADE"), nullable=True)
    employee_id = Column(String(64), nullable=False, index=True)
    similarity_score = Column(Float, nullable=False)
    liveness_score = Column(Float, nullable=False)
    challenge_type = Column(String(32), nullable=True)
    is_match = Column(Boolean, nullable=False)
    is_live = Column(Boolean, nullable=False)
    rejection_reason = Column(String(128), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    profile = relationship("FaceProfile", back_populates="logs")
