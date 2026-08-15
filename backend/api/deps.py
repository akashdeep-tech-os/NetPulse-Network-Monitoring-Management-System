"""Shared API dependencies (current user, current org)."""
from typing import Optional

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from core.dependencies import AuthContext, get_auth_context, get_db


def get_current_org(auth: AuthContext = Depends(get_auth_context)) -> Optional[int]:
    return auth.org_id


def get_current_user_id(auth: AuthContext = Depends(get_auth_context)) -> Optional[int]:
    if auth.user is None:
        raise HTTPException(status_code=403, detail="API keys cannot use user-scoped endpoints")
    return auth.user.id
