from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.settings import get_settings
from app.api.routes.text_processing import router as text_router
from app.api.routes.image_processing import router as image_router
from app.api.routes.word_generation import router as word_router
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
    # Include routers with their new names
    app.include_router(text_router, prefix="/api", tags=["text"])
    app.include_router(image_router, prefix="/api", tags=["image"])
    app.include_router(word_router, prefix="/api/words", tags=["words"])
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

@app.get("/debug/routes")
async def debug_routes():
    routes = []
    for route in app.routes:
        routes.append(str(route))
    return {"routes": routes}

@app.get("/api/test")
async def test():
    return {"message": "Test endpoint working"}

if __name__ == "__main__":
    import uvicorn
    # Use PORT from environment variable (for Render) or default to 8000
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port) 
