"""
Centralized configuration for the BraillePay backend.

Everything here is read from environment variables (see .env.example).
No secrets or connection strings are hardcoded.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Mongo
    mongo_url: str = "mongodb://localhost:27017"
    db_name: str = "braillepay"

    # JWT
    jwt_secret: str = "insecure-dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 10080  # 7 days

    # CORS
    cors_origins: str = "http://localhost:5500"

    # WebAuthn
    webauthn_rp_id: str = "localhost"
    webauthn_rp_name: str = "BraillePay"
    webauthn_origins: str = "http://localhost:5500"

    # Demo / deployment
    demo_mode: bool = True
    port: int = 8000

    # Security
    login_max_attempts: int = 5
    login_lockout_minutes: int = 15

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def webauthn_origin_list(self) -> list[str]:
        return [o.strip() for o in self.webauthn_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
