"""API key endpoints: create, list, revoke, delete."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api_keys import service as api_keys_service
from core.dependencies import AuthContext, get_auth_context, get_db, require_permission
from models import Organization
from schemas import ApiKeyCreate, ApiKeyCreated, ApiKeyOut, Message
from tenants.service import get_org_plan, get_organization

router = APIRouter(prefix="/api-keys", tags=["api-keys"])

keys_manage = require_permission("api_keys.manage")


def _org(db: Session, auth: AuthContext) -> Organization:
    if auth.org_id is None:
        raise HTTPException(status_code=400, detail="No organization context")
    return get_organization(db, auth.org_id)


@router.get("", response_model=list[ApiKeyOut])
def list_keys(auth=Depends(keys_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return api_keys_service.list_api_keys(db, org.id)


@router.post("", response_model=ApiKeyCreated)
def create_key(body: ApiKeyCreate, auth=Depends(keys_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    plan = get_org_plan(db, org)
    key, plain = api_keys_service.create_api_key(
        db, org.id, body.name, body.scopes,
        created_by=auth.user.id if auth.user else 0,
        expires_at=body.expires_at,
        max_api_keys=plan.max_api_keys,
    )
    return ApiKeyCreated(id=key.id, name=key.name, key_prefix=key.key_prefix, scopes=key.scopes,
                         expires_at=key.expires_at, last_used_at=key.last_used_at,
                         revoked_at=key.revoked_at, created_at=key.created_at,
                         plain_key=plain)


@router.patch("/{key_id}/revoke", response_model=Message)
def revoke_key(key_id: int, auth=Depends(keys_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    api_keys_service.revoke_api_key(db, org.id, key_id)
    return Message(message="API key revoked")


@router.delete("/{key_id}", response_model=Message)
def delete_key(key_id: int, auth=Depends(keys_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    api_keys_service.delete_api_key(db, org.id, key_id)
    return Message(message="API key deleted")
