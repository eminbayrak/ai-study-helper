from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.settings import get_settings
from app.api.routes import text_processing, image_processing, word_generation
import os

settings = get_settings()

app = FastAPI(title="AI Study Helper API")

# Updated CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Include routers
app.include_router(text_processing.router, prefix="/api", tags=["text"])
app.include_router(image_processing.router, prefix="/api", tags=["image"])
app.include_router(word_generation.router, prefix="/api", tags=["words"])

# Add a health check endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy"} 