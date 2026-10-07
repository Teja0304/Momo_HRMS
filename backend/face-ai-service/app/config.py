import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PORT: int = 3006
    HOST: str = "0.0.0.0"
    ENVIRONMENT: str = "development"
    API_PREFIX: str = "/api/v1"
    
    DATABASE_URL: str = "mysql+pymysql://admin:Admin123@localhost:3306/face_ai_db"
    
    FACE_SIMILARITY_THRESHOLD: float = 0.40
    LIVENESS_CONFIDENCE_THRESHOLD: float = 0.80
    CHALLENGE_TIMEOUT_SECONDS: int = 30
    VERIFICATION_TOKEN_TTL_SECONDS: int = 300
    
    GATEWAY_SHARED_SECRET: str = "dev-gateway-secret"
    FACE_JWT_SECRET: str = "dev-face-secret-key-change-in-prod"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
