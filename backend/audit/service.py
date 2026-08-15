"""Audit logging service. Records every meaningful action per organization."""
import json
from typing import Optional

from fastapi import Request
from sqlalchemy.orm import Session

from models import AuditLog


def log_action(
    db: Session,
    action: str,
    resource: str,
    resource_id: Optional[str] = None,
    organization_id: Optional[int] = None,
    user=None,
    request: Optional[Request] = None,
    metadata: Optional[dict] = None,
) -> None:
    ip_address = None
    user_agent = None
    if request is not None:
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

    log = AuditLog(
        organization_id=organization_id,
        user_id=user.id if user else None,
        user_name=getattr(user, "username", None) or getattr(user, "display_name", None),
        action=action,
        resource=resource,
        resource_id=str(resource_id) if resource_id is not None else None,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata=metadata,
    )
    db.add(log)


def log_action_commit(db: Session, *args, **kwargs) -> None:
    log_action(db, *args, **kwargs)
    db.commit()
