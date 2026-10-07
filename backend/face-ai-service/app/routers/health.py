from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db

router = APIRouter(tags=["Health"])

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    db_status = "down"
    try:
        db.execute(text("SELECT 1"))
        db_status = "up"
    except Exception:
        db_status = "down"

    return {
        "status": "healthy" if db_status == "up" else "unhealthy",
        "service": "face-ai-service",
        "database": db_status,
    }
