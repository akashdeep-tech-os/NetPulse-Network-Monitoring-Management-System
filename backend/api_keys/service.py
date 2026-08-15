"""API key management. Keys are hashed in the database and shown only once."""
from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.security import generate_api_key, utcnow
from models import ApiKey


def create_api_key(
    db: Session,
    organization_id: int,
    name: str,
    scopes: list[str],
    created_by: int,
    expires_at: Optional[datetime] = None,
    max_api_keys: int = 5,
) -> tuple[ApiKey, str]:
    active = db.query(ApiKey).filter(ApiKey.organization_id == organization_id, ApiKey.revoked_at.is_(None)).count()
    if active >= max_api_keys:
        raise HTTPException(
            status_code=400,
            detail=f"API key limit reached ({max_api_keys}). Revoke an existing key or upgrade your plan.",
        )
    plain, prefix, key_hash = generate_api_key()
    key = ApiKey(
        organization_id=organization_id,
        name=name,
        key_hash=key_hash,
        key_prefix=prefix,
        scopes=scopes,
        created_by=created_by,
        expires_at=expires_at,
    )
    db.add(key)
    db.commit()
    db.refresh(key)
    return key, plain


def list_api_keys(db: Session, organization_id: int) -> list[ApiKey]:
    return (
        db.query(ApiKey)
        .filter(ApiKey.organization_id == organization_id)
        .order_by(ApiKey.created_at.desc())
        .all()
    )


def _get_key(db: Session, organization_id: int, key_id: int) -> ApiKey:
    key = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.organization_id == organization_id).first()
    if key is None:
        raise HTTPException(status_code=404, detail="API key not found")
    return key


def revoke_api_key(db: Session, organization_id: int, key_id: int) -> ApiKey:
    key = _get_key(db, organization_id, key_id)
    key.revoked_at = utcnow()
    db.commit()
    db.refresh(key)
    return key


def delete_api_key(db: Session, organization_id: int, key_id: int) -> None:
    key = _get_key(db, organization_id, key_id)
    db.delete(key)
    db.commit()
