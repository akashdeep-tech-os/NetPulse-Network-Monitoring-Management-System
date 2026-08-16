"""User management within an organization."""
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.security import hash_password
from models import Role, User

ROLE_RANK = {
    "viewer": 0,
    "network_operator": 1,
    "network_manager": 2,
    "org_admin": 3,
    "org_owner": 4,
    "platform_admin": 5,
}


def _role_rank(user: User) -> int:
    if user.is_platform_admin:
        return ROLE_RANK["platform_admin"]
    if user.role is None:
        return ROLE_RANK["viewer"]
    return ROLE_RANK.get(user.role.name, ROLE_RANK["viewer"])


def can_assign_role(actor: Optional[User], role: Role) -> bool:
    """Actor may only assign roles strictly below their own rank. Super admin can assign any."""
    if actor is None:
        return False
    if actor.is_platform_admin:
        return True
    return ROLE_RANK.get(role.name, ROLE_RANK["viewer"]) < _role_rank(actor)


def can_manage_user(actor: Optional[User], target: User) -> bool:
    """Actor may only manage users at or below their own rank; platform admins are untouchable."""
    if actor is None:
        return False
    if actor.is_platform_admin:
        return True
    if target.is_platform_admin:
        return False
    return _role_rank(target) <= _role_rank(actor)


def get_user_roles(db: Session) -> list[Role]:
    return (
        db.query(Role)
        .filter(Role.scope == "organization")
        .order_by(Role.id)
        .all()
    )


def get_role_by_id(db: Session, role_id: int) -> Optional[Role]:
    return db.query(Role).filter(Role.id == role_id).first()


def ensure_user_limit(db: Session, organization_id: int, plan_max_users: int) -> None:
    count = db.query(User).filter(User.organization_id == organization_id, User.is_active.is_(True)).count()
    if count >= plan_max_users:
        raise HTTPException(
            status_code=400,
            detail=f"User limit reached ({plan_max_users}). Upgrade your plan to add more users.",
        )


def create_user(
    db: Session,
    organization_id: int,
    username: str,
    email: str,
    password: str,
    role_id: Optional[int],
    full_name: Optional[str] = None,
    plan_max_users: int = 5,
) -> User:
    ensure_user_limit(db, organization_id, plan_max_users)
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already exists")
    if role_id is None:
        role = db.query(Role).filter(Role.name == "network_manager").first()
        role_id = role.id if role else None

    user = User(
        organization_id=organization_id,
        username=username,
        email=email,
        full_name=full_name,
        hashed_password=hash_password(password),
        role_id=role_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def list_org_users(db: Session, organization_id: int) -> list[User]:
    return (
        db.query(User)
        .filter(User.organization_id == organization_id)
        .order_by(User.created_at.desc())
        .all()
    )


def get_org_user(db: Session, organization_id: int, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id, User.organization_id == organization_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def update_org_user(db: Session, organization_id: int, user_id: int, **fields) -> User:
    user = get_org_user(db, organization_id, user_id)
    if "role_id" in fields and fields["role_id"] is not None:
        role = get_role_by_id(db, fields["role_id"])
        if role is None or role.scope != "organization":
            raise HTTPException(status_code=400, detail="Invalid role")
        user.role_id = role.id
    for key in ("full_name", "is_active"):
        if key in fields and fields[key] is not None:
            setattr(user, key, fields[key])
    db.commit()
    db.refresh(user)
    return user


def delete_org_user(db: Session, organization_id: int, user_id: int, current_user: User) -> None:
    user = get_org_user(db, organization_id, user_id)
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    if user.is_platform_admin:
        raise HTTPException(status_code=400, detail="Cannot delete platform administrators")
    db.delete(user)
    db.commit()


def get_user_permission_names(user: User) -> list[str]:
    if user.is_platform_admin:
        perms = {p.name for p in user.role.permissions} if user.role else set()
        perms.add("platform.view")
        return sorted(perms)
    if user.role is None:
        return []
    return sorted(p.name for p in user.role.permissions)


def get_role_permission_names(role: Role) -> list[str]:
    return sorted(p.name for p in role.permissions)


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    from core.security import verify_password

    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    user.hashed_password = hash_password(new_password)
    db.commit()
