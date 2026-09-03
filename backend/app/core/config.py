"""
Application configuration module.
Loads settings from environment variables or a local .env file.
"""

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Core API Configurations
    APP_NAME: str = "AI Customer Retention Platform API"
    APP_ENV: str = "development"
    API_V1_STR: str = "/api/v1"

    # Security & Authentication
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD_HASH: str = ""

    # Registration is disabled by default; enable explicitly for dev/demo environments.
    ALLOW_USER_REGISTRATION: bool = False

    # Maximum CSV upload size in megabytes.
    MAX_UPLOAD_SIZE_MB: int = 25

    # Database Persistence
    DATABASE_URL: str = "sqlite:///./customer_retention.db"

    # CORS Allowed Origins
    ALLOWED_ORIGINS: str = "http://localhost:8501,http://127.0.0.1:8501"

    _DEV_JWT_SECRET: str = "dev-only-jwt-secret-change-me-in-production"
    _DEV_ADMIN_PASSWORD_HASH: str = (
        "$2b$12$w5uwmvOZ7LEYex5dC7L3/uzqj0jXnSsOJuwwj3zAXWDjE5jRi8LUG"
    )

    @model_validator(mode="after")
    def apply_development_defaults(self) -> "Settings":
        """Apply dev-only credential defaults when running locally without a .env file."""
        if self.APP_ENV in ("development", "test"):
            if not self.JWT_SECRET:
                self.JWT_SECRET = self._DEV_JWT_SECRET
            if not self.ADMIN_PASSWORD_HASH:
                self.ADMIN_PASSWORD_HASH = self._DEV_ADMIN_PASSWORD_HASH
            if os.getenv("ALLOW_USER_REGISTRATION") is None:
                self.ALLOW_USER_REGISTRATION = True
        return self

    @model_validator(mode="after")
    def validate_allowed_origins(self) -> "Settings":
        if self.ALLOWED_ORIGINS:
            origins = [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]
            for origin in origins:
                if not (origin.startswith("http://") or origin.startswith("https://")):
                    import logging
                    logger = logging.getLogger("backend.app.core.config")
                    logger.error(
                        f"CORS CONFIGURATION ERROR: Invalid origin '{origin}' in ALLOWED_ORIGINS. "
                        f"Origins must start with http:// or https://. "
                        f"Falling back to default localhost origins."
                    )
                    self.ALLOWED_ORIGINS = "http://localhost:8501,http://127.0.0.1:8501"
                    break
        return self

    @model_validator(mode="after")
    def enforce_production_secrets(self) -> "Settings":
        """Require explicit secrets before running in production."""
        if self.APP_ENV != "production":
            return self

        if not self.JWT_SECRET or self.JWT_SECRET == self._DEV_JWT_SECRET:
            raise ValueError(
                "SECURITY ERROR: JWT_SECRET must be set to a cryptographically secure "
                "random string before deploying to production."
            )
        if not self.ADMIN_PASSWORD_HASH or self.ADMIN_PASSWORD_HASH == self._DEV_ADMIN_PASSWORD_HASH:
            raise ValueError(
                "SECURITY ERROR: ADMIN_PASSWORD_HASH must be set to a unique bcrypt hash "
                "before deploying to production. Generate with: "
                "python -c \"import bcrypt; print(bcrypt.hashpw(b'YOUR_PASSWORD', bcrypt.gensalt()).decode())\""
            )
        return self

    @model_validator(mode="after")
    def resolve_sqlite_db_path(self) -> "Settings":
        if self.DATABASE_URL.startswith("sqlite:///"):
            db_path = self.DATABASE_URL.split("sqlite:///", 1)[1]
            if not os.path.isabs(db_path):
                backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                if db_path.startswith("./") or db_path.startswith(".\\"):
                    db_path = db_path[2:]
                abs_db_path = os.path.abspath(os.path.join(backend_dir, db_path))
                self.DATABASE_URL = f"sqlite:///{abs_db_path}"
        return self


settings = Settings()
