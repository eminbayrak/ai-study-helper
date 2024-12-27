from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "AI Study Helper"
    CORS_ORIGINS: list[str] = ["*"]  # In production, replace with actual origins
    MODEL_PATH: str = "facebook/bart-large-cnn"

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings() 