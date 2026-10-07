import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.routers import face, health

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("face-ai-service")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database tables for face_ai_db...")
    Base.metadata.create_all(bind=engine)
    logger.info("Face AI Service startup complete.")
    yield
    logger.info("Face AI Service shutting down.")

app = FastAPI(
    title="Face AI & Biometrics Service",
    description="Face enrollment, active liveness verification, and anti-spoofing microservice",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(health.router)
app.include_router(health.router, prefix=settings.API_PREFIX)
app.include_router(face.router, prefix=settings.API_PREFIX)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
