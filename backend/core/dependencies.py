"""Shared FastAPI dependencies: DB session, auth context, permission enforcement."""
from dataclasses import dataclass, field
from typing import Generator, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyHeader, OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from core.security import decode_access_token, verify_api_key
from database.session import SessionLocal
from models import ApiKey, Organization, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

PERMISSION_DENIED = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="Permission denied",
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@dataclass
class AuthContext:
    """Authenticated principal: either a user (JWT) or an API key, scoped to an organization."""

    db: Session
    user: Optional[User] = None
    organization: Optional[Organization] = None
    is_api_key: bool = False
    scopes: set = field(default_factory=set)

    @property
    def org_id(self) -> Optional[int]:
        if self.organization is not None:
            return self.organization.id
        if self.user is not None:
            return self.user.organization_id
        return None

    @property
    def display_name(self) -> str:
        if self.user is not None:
            return self.user.username
        return "api-key"


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub", ""))
    except (JWTError, ValueError, TypeError):
        raise _unauthorized()
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise _unauthorized()
    return user


def get_auth_context(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme_optional),
    api_key: Optional[str] = Depends(api_key_header),
    db: Session = Depends(get_db),
) -> AuthContext:
    if api_key:
        keys = db.query(ApiKey).filter(ApiKey.revoked_at.is_(None)).all()
        for candidate in keys:
            if verify_api_key(api_key, candidate.key_hash):
                if candidate.expires_at and candidate.expires_at < _now():
                    raise HTTPException(status_code=401, detail="API key expired")
                candidate.last_used_at = _now()
                org = db.query(Organization).filter(Organization.id == candidate.organization_id).first()
                if org is None:
                    raise HTTPException(status_code=403, detail="Organization not found")
                ctx = AuthContext(db=db, organization=org, is_api_key=True, scopes=set(candidate.scopes or []))
                request.state.auth = ctx
                db.commit()
                return ctx
        raise HTTPException(status_code=401, detail="Invalid API key")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_current_user(token, db)
    org = None
    if user.organization_id is not None:
        org = db.query(Organization).filter(Organization.id == user.organization_id).first()
        if org is None:
            raise HTTPException(status_code=403, detail="Organization not found")
        if org.status == "suspended":
            raise HTTPException(status_code=403, detail="Organization is suspended")
    ctx = AuthContext(db=db, user=user, organization=org)
    request.state.auth = ctx
    return ctx


def _now():
    from core.security import utcnow

    return utcnow()


def require_permission(permission: str):
    """Dependency factory. Enforces permission-based authorization on every endpoint."""

    def checker(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if ctx.is_api_key:
            if permission not in ctx.scopes:
                raise PERMISSION_DENIED
            return ctx
        if ctx.user is None:
            raise PERMISSION_DENIED
        user = ctx.user
        if user.is_platform_admin and permission.startswith("platform."):
            return ctx
        names = set()
        if user.role is not None:
            names = {p.name for p in user.role.permissions}
        if permission not in names:
            raise PERMISSION_DENIED
        return ctx

    return checker


def require_platform_admin(
    ctx: AuthContext = Depends(get_auth_context),
) -> AuthContext:
    if ctx.is_api_key or ctx.user is None or not ctx.user.is_platform_admin:
        raise PERMISSION_DENIED
    return ctx


def require_org(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
    """Requires the principal to be scoped to an organization."""
    if ctx.org_id is None:
        raise HTTPException(status_code=400, detail="No organization context")
    return ctx


def org_membership_required(user: User) -> None:
    """Guard helper: user must belong to an organization to use org APIs."""
    if user.organization_id is None:
        raise HTTPException(status_code=403, detail="Platform administrators cannot use organization APIs")
