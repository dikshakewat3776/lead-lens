from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Default connection points to the `local` database; tables live in `lead_lens` schema.
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/local"
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl_seconds: int = 120
    jwt_secret: str = "change-me-in-production-use-openssl-rand-hex-32"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"


@lru_cache
def get_settings() -> Settings:
    return Settings()
