from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache

class Settings(BaseSettings):
    # API settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "AI Study Helper"
    CORS_ORIGINS: List[str] = [
        "http://localhost:8081",
        "http://localhost:3000",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:3000"
    ]
    
    # Server settings
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    
    # Model settings
    MODEL_PATH: str = "facebook/bart-large-cnn"
    SUMMARIZATION_MODEL: str = "facebook/bart-large-cnn"
    QUESTION_GENERATION_MODEL: str = "google/flan-t5-base"
    MAX_TEXT_LENGTH: int = 1024

    class Config:
        env_file = ".env"
        case_sensitive = True

@lru_cache()
def get_settings():
    return Settings() 