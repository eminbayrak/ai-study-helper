from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.settings import get_settings
import os
import sys

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

try:
    from app.api.routes import text_processing, image_processing, word_generation
    # Include routers
    app.include_router(text_processing.router, prefix="/api", tags=["text"])
    app.include_router(image_processing.router, prefix="/api", tags=["image"])
    app.include_router(word_generation.router, prefix="/api", tags=["words"])
except Exception as e:
    print(f"Error importing routes: {str(e)}", file=sys.stderr)
    print(f"Current directory: {os.getcwd()}", file=sys.stderr)
    print(f"Directory contents: {os.listdir('.')}", file=sys.stderr)
    print(f"App directory contents: {os.listdir('app')}", file=sys.stderr)
    print(f"Routes directory contents: {os.listdir('app/api/routes')}", file=sys.stderr)
    raise

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/")
async def root():
    return {"status": "healthy", "message": "AI Study Helper API is running"} 