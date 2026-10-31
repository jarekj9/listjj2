import os
from dataclasses import dataclass, field
from functools import lru_cache


def _env_list(name: str) -> list[str]:
    return [v.strip() for v in os.getenv(name, "").split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    app_version: str = os.getenv("APP_VERSION", "0.1.0")
    deployment_name: str = os.getenv("DEPLOYMENT_NAME", "local")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:////data/listjj.db")
    jwt_secret: str = os.getenv("JWT_SECRET", "")
    jwt_issuer: str = os.getenv("JWT_ISSUER", "listjj")
    jwt_expiry_days: int = int(os.getenv("JWT_EXPIRY_DAYS", "30"))
    admin_email: str = os.getenv("ADMIN_EMAIL", "").strip().lower()
    admin_bootstrap_token: str = os.getenv("ADMIN_BOOTSTRAP_TOKEN", "")
    google_client_id: str = os.getenv("GOOGLE_CLIENT_ID", "")
    microsoft_client_id: str = os.getenv("MICROSOFT_CLIENT_ID", "")
    microsoft_tenant_id: str = os.getenv("MICROSOFT_TENANT_ID", "common")
    cors_origins: list[str] = field(default_factory=lambda: _env_list("CORS_ORIGINS"))
    max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "20"))

    def __post_init__(self) -> None:
        if self.max_upload_mb < 1:
            raise ValueError("MAX_UPLOAD_MB must be a positive integer.")


@lru_cache
def get_settings() -> Settings:
    return Settings()
