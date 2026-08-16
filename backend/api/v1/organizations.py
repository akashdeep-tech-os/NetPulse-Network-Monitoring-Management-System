"""Organization endpoints: profile, settings, usage, membership."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from audit.service import log_action
from core.dependencies import (
    AuthContext,
    get_auth_context,
    get_db,
    require_permission,
)
from models import Organization, User
from schemas import (
    Message,
    OrganizationOut,
    OrganizationUpdate,
    SubscriptionOut,
    UsageOut,
    UserCreate,
    UserUpdate,
)
from tenants import service as tenants_service
from users import service as users_service

router = APIRouter(prefix="/organizations", tags=["organizations"])


def _org_or_400(auth: AuthContext) -> Organization:
    if auth.org_id is None:
        raise HTTPException(status_code=400, detail="Platform administrators have no organization context")
    return tenants_service.get_organization(auth.db, auth.org_id)


@router.get("/me", response_model=OrganizationOut)
def my_organization(auth=Depends(get_auth_context), db: Session = Depends(get_db)):
    org = _org_or_400(auth)
    plan = tenants_service.get_org_plan(db, org)
    return OrganizationOut.model_validate(org, update={"plan": plan})


@router.patch("/me", response_model=OrganizationOut)
def update_org(body: OrganizationUpdate, auth=Depends(get_auth_context), db: Session = Depends(get_db)):
    org = _org_or_400(auth)
    org = tenants_service.update_organization(db, org.id, **body.model_dump(exclude_unset=True))
    log_action(db, "organization.update", "organization", str(org.id), organization_id=org.id)
    db.commit()
    plan = tenants_service.get_org_plan(db, org)
    return OrganizationOut.model_validate(org, update={"plan": plan})


@router.get("/me/subscription", response_model=SubscriptionOut)
def my_subscription(auth=Depends(get_auth_context), db: Session = Depends(get_db)):
    org = _org_or_400(auth)
    return tenants_service.get_subscription(db, org.id)


@router.get("/me/usage", response_model=list[UsageOut])
def my_usage(auth=Depends(get_auth_context), db: Session = Depends(get_db)):
    org = _org_or_400(auth)
    return tenants_service.get_usage(db, org.id)


@router.get("/me/users")
def my_users(auth=Depends(require_permission("users.view")), db: Session = Depends(get_db)):
    org = _org_or_400(auth)
    out = []
    for u in users_service.list_org_users(db, org.id):
        item = {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name,
            "role_id": u.role_id,
            "role_name": u.role.name if u.role else None,
            "permissions": users_service.get_user_permission_names(u),
            "is_active": u.is_active,
            "last_login_at": u.last_login_at,
            "created_at": u.created_at,
        }
        out.append(item)
    return out


@router.post("/me/users", response_model=Message)
def add_user(body: UserCreate, auth: AuthContext = Depends(require_permission("users.create")), db: Session = Depends(get_db)):
    org = _org_or_400(auth)
    if body.role_id is not None:
        role = users_service.get_role_by_id(db, body.role_id)
        if role is None or role.scope != "organization":
            raise HTTPException(status_code=400, detail="Invalid role")
        if not users_service.can_assign_role(auth.user, role):
            raise HTTPException(status_code=403, detail="You cannot assign this role")
    plan = tenants_service.get_org_plan(db, org)
    user = users_service.create_user(db, org.id, body.username, body.email, body.password,
                                     body.role_id, full_name=body.full_name,
                                     plan_max_users=plan.max_users)
    log_action(db, "user.create", "user", str(user.id), organization_id=org.id)
    db.commit()
    return Message(message=f"User {body.username} created")


@router.patch("/me/users/{user_id}", response_model=Message)
def update_user(user_id: int, body: UserUpdate, auth: AuthContext = Depends(require_permission("users.manage")), db: Session = Depends(get_db)):
    org = _org_or_400(auth)
    target = users_service.get_org_user(db, org.id, user_id)
    if not users_service.can_manage_user(auth.user, target):
        raise HTTPException(status_code=403, detail="You cannot manage this user")
    if body.role_id is not None:
        role = users_service.get_role_by_id(db, body.role_id)
        if role is None or role.scope != "organization":
            raise HTTPException(status_code=400, detail="Invalid role")
        if not users_service.can_assign_role(auth.user, role):
            raise HTTPException(status_code=403, detail="You cannot assign this role")
    users_service.update_org_user(db, org.id, user_id, **body.model_dump(exclude_unset=True))
    log_action(db, "user.update", "user", str(user_id), organization_id=org.id)
    db.commit()
    return Message(message="User updated")


@router.delete("/me/users/{user_id}", response_model=Message)
def delete_user(user_id: int, auth: AuthContext = Depends(require_permission("users.manage")), db: Session = Depends(get_db)):
    org = _org_or_400(auth)
    current = db.query(User).filter(User.id == (auth.user.id if auth.user else 0)).first()
    target = users_service.get_org_user(db, org.id, user_id)
    if not users_service.can_manage_user(auth.user, target):
        raise HTTPException(status_code=403, detail="You cannot manage this user")
    users_service.delete_org_user(db, org.id, user_id, current)
    log_action(db, "user.delete", "user", str(user_id), organization_id=org.id)
    db.commit()
    return Message(message="User deleted")


@router.get("/roles", response_model=list)
def list_roles(auth=Depends(require_permission("users.view")), db: Session = Depends(get_db)):
    return [
        {"id": r.id, "name": r.name, "display_name": r.description, "scope": r.scope,
         "permissions": [p.name for p in r.permissions]}
        for r in users_service.get_user_roles(db)
    ]
