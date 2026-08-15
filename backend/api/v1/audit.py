"""Audit log endpoints (org-scoped)."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.dependencies import AuthContext, get_auth_context, get_db, require_permission
from models import AuditLog, Organization
from schemas import AuditLogOut
from tenants.service import get_organization

router = APIRouter(prefix="/audit", tags=["audit"])

audit_perm = require_permission("audit.view")


def _org(db: Session, auth: AuthContext) -> Organization:
    if auth.org_id is None:
        raise HTTPException(status_code=400, detail="No organization context")
    return get_organization(db, auth.org_id)


@router.get("/logs", response_model=list[AuditLogOut])
def list_logs(action: Optional[str] = None, resource: Optional[str] = None,
              limit: int = 200, offset: int = 0,
              auth=Depends(audit_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    query = db.query(AuditLog).filter(AuditLog.organization_id == org.id)
    if action:
        query = query.filter(AuditLog.action == action)
    if resource:
        query = query.filter(AuditLog.resource == resource)
    return query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
