"""Auth endpoints: login, refresh, logout, sessions, password reset, email verification."""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from audit.service import log_action
from auth import service as auth_service
from core.dependencies import get_auth_context, get_db
from core.security import create_access_token
from models import Organization, User
from schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginResponse,
    Message,
    RefreshRequest,
    ResetPasswordRequest,
    SessionOut,
    Token,
    UserOut,
)
from users import service as users_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _role_name(user: User) -> str:
    return user.role.name if user.role else ("" if user.is_platform_admin else "viewer")


@router.post("/login", response_model=LoginResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), request: Request = None, db: Session = Depends(get_db)):
    user = auth_service.authenticate(db, form.username, form.password, request)
    token = create_access_token(str(user.id), user.organization_id, _role_name(user))
    _, refresh = auth_service.create_session(db, user, request)
    org_name = None
    if user.organization_id:
        org = db.query(Organization).filter(Organization.id == user.organization_id).first()
        org_name = org.name if org else None
    log_action(db, "auth.login", "user", str(user.id), organization_id=user.organization_id, user=user)
    db.commit()
    user_out = UserOut.model_validate(user)
    user_out.role_name = _role_name(user)
    user_out.permissions = users_service.get_user_permission_names(user)
    return LoginResponse(
        access_token=token,
        refresh_token=refresh,
        token_type="bearer",
        user=user_out,
        organization_name=org_name,
    )


@router.post("/refresh", response_model=Token)
def refresh(body: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    user, refresh = auth_service.rotate_session(db, body.refresh_token, request)
    token = create_access_token(str(user.id), user.organization_id, _role_name(user))
    return Token(access_token=token, refresh_token=refresh, token_type="bearer")


@router.post("/logout", response_model=Message)
def logout(body: RefreshRequest, db: Session = Depends(get_db)):
    auth_service.revoke_session(db, body.refresh_token)
    return Message(message="Logged out")


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(auth=Depends(get_auth_context), db: Session = Depends(get_db)):
    if auth.user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return auth_service.list_sessions(db, auth.user.id)


@router.post("/sessions/{session_id}/revoke", response_model=Message)
def revoke_session(session_id: int, auth=Depends(get_auth_context), db: Session = Depends(get_db)):
    if auth.user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    auth_service.revoke_session_by_id(db, session_id, auth.user.id)
    return Message(message="Session revoked")


@router.post("/sessions/revoke-all", response_model=Message)
def revoke_all(auth=Depends(get_auth_context), db: Session = Depends(get_db)):
    if auth.user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    auth_service.revoke_all_sessions(db, auth.user.id)
    return Message(message="All sessions revoked")


@router.post("/password-reset/request", response_model=Message)
def request_reset(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    token = auth_service.request_password_reset(db, body.email)
    if token:
        log_action(db, "auth.password_reset_requested", "user", None, organization_id=None)
        db.commit()
    return Message(message="If that email is registered, a reset link has been sent.")


@router.post("/password-reset/confirm", response_model=Message)
def confirm_reset(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    auth_service.reset_password(db, body.token, body.new_password)
    return Message(message="Password updated successfully")


@router.get("/verify-email", response_model=Message)
def verify_email(token: str, db: Session = Depends(get_db)):
    auth_service.verify_email(db, token)
    return Message(message="Email verified")


@router.post("/change-password", response_model=Message)
def change_password(body: ChangePasswordRequest, auth=Depends(get_auth_context), db: Session = Depends(get_db)):
    if auth.user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    users_service.change_password(db, auth.user, body.current_password, body.new_password)
    auth_service.revoke_all_sessions(db, auth.user.id)
    return Message(message="Password changed; other sessions revoked")


@router.get("/me", response_model=UserOut)
def me(auth=Depends(get_auth_context), db: Session = Depends(get_db)):
    user = auth.user
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
