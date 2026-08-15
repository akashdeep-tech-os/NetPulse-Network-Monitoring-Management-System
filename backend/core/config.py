"""Application configuration. All secrets come from environment variables."""
import os
import sys
import secrets
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_env():
    if load_dotenv:
        load_dotenv(BASE_DIR / ".env")
        if getattr(sys, "frozen", False):
            load_dotenv(Path(sys.executable).parent / ".env")


_load_env()


def get_data_dir() -> Path:
    if getattr(sys, "frozen", False):
        base = os.environ.get("LOCALAPPDATA") or Path(sys.executable).parent
        return Path(base) / "NetPulse"
    return BASE_DIR


DATA_DIR = Path(os.getenv("DATA_DIR", str(get_data_dir())))
DATA_DIR.mkdir(parents=True, exist_ok=True)


def _load_or_create_secret_key() -> str:
    env_key = os.getenv("JWT_SECRET_KEY", "").strip()
    if env_key:
        return env_key
    key_file = DATA_DIR / ".secret_key"
    try:
        if key_file.is_file():
            stored = key_file.read_text().strip()
            if stored:
                return stored
        key = secrets.token_hex(32)
        key_file.write_text(key)
        return key
    except Exception:
        return secrets.token_hex(32)


class Settings:
    APP_NAME = "NetPulse"
    APP_VERSION = "1.0.0"
    APP_ENV = os.getenv("APP_ENV", "development")
    DEBUG = APP_ENV != "production"

    # Database (PostgreSQL in production, SQLite for local development)
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./netpulse.db")

    # Auth
    JWT_SECRET_KEY = _load_or_create_secret_key()
    JWT_ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "14"))

    CORS_ORIGINS = [
        o.strip()
        for o in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
        ).split(",")
        if o.strip()
    ]
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # SMTP
    SMTP_HOST = os.getenv("SMTP_HOST", "")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM = os.getenv("SMTP_FROM", "")
    SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    # Slack
    SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")

    # AI provider abstraction
    AI_PROVIDER = os.getenv("AI_PROVIDER", "rule_based")  # rule_based | openai | custom
    AI_API_KEY = os.getenv("AI_API_KEY", "")
    AI_MODEL = os.getenv("AI_MODEL", "")
    AI_BASE_URL = os.getenv("AI_BASE_URL", "")

    REDIS_URL = os.getenv("REDIS_URL", "")

    # Login protection
    LOGIN_MAX_ATTEMPTS = int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"))
    LOGIN_WINDOW_MINUTES = int(os.getenv("LOGIN_WINDOW_MINUTES", "15"))

    # Monitoring engine
    MONITORING_WORKERS = int(os.getenv("MONITORING_WORKERS", "32"))
    SCHEDULER_TICK_SECONDS = int(os.getenv("SCHEDULER_TICK_SECONDS", "5"))

    # Initial platform admin (seeded on first start)
    ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")

    DATA_DIR = DATA_DIR


settings = Settings()
