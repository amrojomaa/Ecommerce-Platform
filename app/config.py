import os
from typing import List


def _to_bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _to_int(value: str, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _to_list(value: str, default: List[str]) -> List[str]:
    if not value:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    def __init__(self) -> None:
        self.app_env = os.getenv("APP_ENV", "development").strip().lower()
        self.debug = _to_bool(os.getenv("DEBUG"), default=self.app_env != "production")

        self.database_url = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost/fastapi")
        self.jwt_secret_key = os.getenv("JWT_SECRET_KEY", "")
        self.jwt_algorithm = os.getenv("JWT_ALGORITHM", "HS256")
        self.jwt_expire_minutes = _to_int(os.getenv("JWT_EXPIRE_MINUTES"), 180)

        self.cors_origins = _to_list(
            os.getenv("CORS_ORIGINS"),
            [
                "http://localhost:3000",
                "http://localhost:5173",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:5173",
            ],
        )

        self.auto_create_tables = _to_bool(os.getenv("AUTO_CREATE_TABLES"), default=False)
        self.allow_dev_verification_code = _to_bool(os.getenv("ALLOW_DEV_VERIFICATION_CODE"), default=False)

        self.auth_rate_limit_count = _to_int(os.getenv("AUTH_RATE_LIMIT_COUNT"), 10)
        self.auth_rate_limit_window_seconds = _to_int(os.getenv("AUTH_RATE_LIMIT_WINDOW_SECONDS"), 60)

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


settings = Settings()
