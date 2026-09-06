import secrets
from base64 import urlsafe_b64encode
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    S3_ENDPOINT: str
    S3_ACCESS_KEY: str
    S3_SECRET_KEY: str
    OPENAI_API_KEY: str

    # Application URLs
    PUBLIC_BASE_URL: str = "http://127.0.0.1:8000"
    SOCIAL_CALLBACK_BASE_URL: str = "http://127.0.0.1:8000"

    # Instagram (Instagram Login for Business)
    INSTAGRAM_CLIENT_ID: str = ""
    INSTAGRAM_CLIENT_SECRET: str = ""

    # YouTube (YouTube Data API v3)
    YOUTUBE_CLIENT_ID: str = ""
    YOUTUBE_CLIENT_SECRET: str = ""
    YOUTUBE_API_KEY: str = ""

    # Token encryption. In production provide a real Fernet key; in dev
    # we derive a stable key in the secrets service.
    SOCIAL_TOKEN_ENCRYPTION_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()