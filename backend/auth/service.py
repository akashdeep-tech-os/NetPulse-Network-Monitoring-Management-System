"""Authentication service: login, refresh tokens, sessions, password reset, email verification."""
from datetime import timedelta
from typing import Optional

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from audit.service import log_action_commit
from core.config import settings
from core.security import (
    generate_refresh_token,
    generate_otp_token,
    hash_password,
    utcnow,
    verify_password,
)
from models import EmailVerificationToken, PasswordResetToken, User, UserSession

_LOGIN_LIMIT_EXCEPTION = HTTPException(
    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
    detail="Too many failed login attempts. Try again later.",
    headers={"Retry-After": str(settings.LOGIN_WINDOW_MINUTES * 60)},
)


def authenticate(db: Session, username: str, password: str, request: Request) -> User:
    """Validates credentials with account-lockout protection."""
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.locked_until and user.locked_until > utcnow():
        raise _LOGIN_LIMIT_EXCEPTION
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    if not verify_password(password, user.hashed_password):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= settings.LOGIN_MAX_ATTEMPTS:
            user.locked_until = utcnow() + timedelta(minutes=settings.LOGIN_WINDOW_MINUTES)
            user.failed_login_attempts = 0
            db.commit()
            raise _LOGIN_LIMIT_EXCEPTION
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = utcnow()
    db.commit()
    return user


def create_session(db: Session, user: User, request: Request) -> tuple[UserSession, str]:
    """Creates a login session, returns (session, plain_refresh_token)."""
    token, token_hash = generate_refresh_token()
    session = UserSession(
        user_id=user.id,
        organization_id=user.organization_id,
        refresh_token_hash=token_hash,
        device_name=request.headers.get("user-agent", "")[:120] or "Unknown device",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        expires_at=utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session, token


def refresh_access(db: Session, refresh_token: str) -> User:
    from core.security import _sha256, create_access_token

    session = (
        db.query(UserSession)
        .filter(UserSession.refresh_token_hash == _sha256(refresh_token))
        .first()
    )
    if session is None or session.revoked_at is not None:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if session.expires_at < utcnow():
        raise HTTPException(status_code=401, detail="Refresh token expired")
    user = db.query(User).filter(User.id == session.user_id).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Account unavailable")
    return user


def rotate_session(db: Session, refresh_token: str, request: Request) -> tuple[User, str]:
    """Validates a refresh token, revokes it and issues a fresh one (rotation)."""
    from core.security import _sha256

    user = refresh_access(db, refresh_token)
    db.query(UserSession).filter(UserSession.refresh_token_hash == _sha256(refresh_token)).update(
        {"revoked_at": utcnow()}, synchronize_session=False
    )
    db.commit()
    _, plain = create_session(db, user, request)
    return user, plain


def list_sessions(db: Session, user_id: int) -> list[UserSession]:
    return (
        db.query(UserSession)
        .filter(UserSession.user_id == user_id)
        .order_by(UserSession.created_at.desc())
        .all()
    )


def revoke_session(db: Session, refresh_token: str) -> None:
    from core.security import _sha256

    session = (
        db.query(UserSession)
        .filter(UserSession.refresh_token_hash == _sha256(refresh_token))
        .first()
    )
    if session:
        session.revoked_at = utcnow()
        db.commit()


def revoke_session_by_id(db: Session, session_id: int, user_id: int) -> None:
    session = db.query(UserSession).filter(UserSession.id == session_id, UserSession.user_id == user_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    session.revoked_at = utcnow()
    db.commit()


def revoke_all_sessions(db: Session, user_id: int, except_session_id: Optional[int] = None) -> int:
    query = db.query(UserSession).filter(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
    if except_session_id:
        query = query.filter(UserSession.id != except_session_id)
    count = query.count()
    query.update({"revoked_at": utcnow()}, synchronize_session=False)
    db.commit()
    return count


def request_password_reset(db: Session, email: str) -> Optional[str]:
    """Creates a reset token and returns the plain token (delivery is caller's responsibility)."""
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        return None
    token = generate_otp_token()
    from core.security import _sha256

    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).update({"used_at": utcnow()}, synchronize_session=False)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=_sha256(token),
            expires_at=utcnow() + timedelta(hours=2),
        )
    )
    db.commit()
    return token


def reset_password(db: Session, token: str, new_password: str) -> None:
    from core.security import _sha256

    record = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == _sha256(token)).first()
    if record is None or record.used_at is not None or record.expires_at < utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user = db.query(User).filter(User.id == record.user_id).first()
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    record.used_at = utcnow()
    user.hashed_password = hash_password(new_password)
    db.query(UserSession).filter(UserSession.user_id == user.id).update({"revoked_at": utcnow()})
    db.commit()


def create_email_verification(db: Session, user: User) -> str:
    token = generate_otp_token()
    from core.security import _sha256

    db.add(
        EmailVerificationToken(
            user_id=user.id,
            token_hash=_sha256(token),
            expires_at=utcnow() + timedelta(hours=48),
        )
    )
    db.commit()
    return token


def verify_email(db: Session, token: str) -> None:
    from core.security import _sha256

    record = db.query(EmailVerificationToken).filter(EmailVerificationToken.token_hash == _sha256(token)).first()
    if record is None or record.used_at is not None or record.expires_at < utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    user = db.query(User).filter(User.id == record.user_id).first()
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid verification token")
    record.used_at = utcnow()
    user.is_email_verified = True
    db.commit()
