from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache
import os
from dotenv import load_dotenv
from pathlib import Path

# Get the root directory (one level up from backend)
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent

# Load .env from root directory
load_dotenv(ROOT_DIR / '.env')

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
    
    # Debug settings
    DEBUG: bool = True
    
    # Model settings
    MODEL_PATH: str = "facebook/bart-large-cnn"
    SUMMARIZATION_MODEL: str = "facebook/bart-large-cnn"
    QUESTION_GENERATION_MODEL: str = "google/flan-t5-base"
    MAX_TEXT_LENGTH: int = 1024
    
    # OpenRouter settings
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY")
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "gpt-3.5-turbo")

    class Config:
        env_file = ".env"
        case_sensitive = True
        env_file_encoding = 'utf-8'

@lru_cache()
def get_settings() -> Settings:
    return Settings() 