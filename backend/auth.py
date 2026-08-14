from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
import bcrypt
import os
import secrets
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db, DATA_DIR
from models import User


def _load_or_create_secret_key() -> str:
    env_key = os.getenv("SECRET_KEY")
    if env_key and env_key != "your-secret-key-change-in-production-keep-it-secret":
        return env_key
    key_file = os.path.join(DATA_DIR, ".secret_key")
    try:
        if os.path.isfile(key_file):
            with open(key_file, "r") as f:
                stored = f.read().strip()
                if stored:
                    return stored
        key = secrets.token_hex(32)
        with open(key_file, "w") as f:
            f.write(key)
        print("Generated a new JWT secret key and saved it to .secret_key")
        return key
    except Exception:
        return secrets.token_hex(32)


SECRET_KEY = _load_or_create_secret_key()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")) * 24  # 24 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
        user_id = int(sub)
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


def get_user_permissions(user: User) -> list[str]:
    if user.is_admin:
        return [
            "create_users", "manage_users", "create_devices",
            "import_devices", "export_devices", "view_dashboard", "port_scanning"
        ]
    if user.role is None:
        return ["view_dashboard"]
    return [p.name for p in user.role.permissions]


def require_permission(permission_name: str):
    def permission_checker(
        current_user: User = Depends(get_current_user),
    ):
        permissions = get_user_permissions(current_user)
        if permission_name not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission_name} required"
            )
        return current_user
    return permission_checker
