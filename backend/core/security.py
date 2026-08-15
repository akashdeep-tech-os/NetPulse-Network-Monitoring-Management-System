"""Security primitives: password hashing, JWT tokens, API key hashing."""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from core.config import settings


def utcnow() -> datetime:
    """Naive UTC timestamp (stored consistently across SQLite/PostgreSQL)."""
    return datetime.utcnow()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(sub: str, organization_id: Optional[int], role: Optional[str]) -> str:
    payload = {"sub": sub}
    if organization_id is not None:
        payload["org"] = organization_id
    if role:
        payload["role"] = role
    expire = utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload["exp"] = expire
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Raises JWTError on invalid/expired token."""
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def generate_refresh_token() -> tuple[str, str]:
    """Returns (plain_token, sha256_hash). Only the hash is stored."""
    token = secrets.token_urlsafe(48)
    return token, _sha256(token)


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def generate_api_key() -> tuple[str, str, str]:
    """Returns (plain_key, key_prefix, key_hash). Plain key shown only once."""
    prefix = "np_" + secrets.token_urlsafe(6)
    secret = secrets.token_urlsafe(32)
    plain = f"{prefix}.{secret}"
    return plain, prefix, _sha256(plain)


def verify_api_key(plain_key: str, key_hash: str) -> bool:
    return hmac.compare_digest(_sha256(plain_key), key_hash)


def generate_otp_token() -> str:
    return secrets.token_urlsafe(32)
