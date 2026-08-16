"""Platform admin console: system stats, organizations, plans, subscriptions, settings."""
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from audit.service import log_action
from billing import service as billing_service
from core.dependencies import AuthContext, get_auth_context, get_db, require_platform_admin
from core.security import utcnow
from models import (
    AIInsight,
    AlertLog,
    ApiKey,
    AuditLog,
    CheckResult,
    Device,
    Organization,
    Plan,
    Subscription,
    User,
)
from schemas import (
    Message,
    PlanCreate,
    PlanOut,
    PlanUpdate,
    PlatformStats,
    SettingUpdate,
    UserCreate,
    UserUpdate,
)
from users import service as users_service

router = APIRouter(prefix="/platform", tags=["platform"], dependencies=[Depends(require_platform_admin)])


@router.get("/stats", response_model=PlatformStats)
def stats(db: Session = Depends(get_db)):
    total_orgs = db.query(Organization).count()
    active_orgs = db.query(Organization).filter(Organization.status == "active").count()
    total_users = db.query(User).count()
    total_devices = db.query(Device).count()
    checks_24h = db.query(CheckResult).filter(CheckResult.timestamp >= utcnow() - timedelta(hours=24)).count()
    alerts_24h = db.query(AlertLog).filter(AlertLog.created_at >= utcnow() - timedelta(hours=24)).count()
    insights = db.query(AIInsight).count()
    revenue = sum(p.price for p in db.query(Plan).all() if p.price)  # placeholder until real billing
    from models import AlertRule, DeviceCheck

    plans = db.query(Plan).all()
    plan_distribution: dict[str, int] = {}
    for org in db.query(Organization).all():
        plan_name = "free"
        sub = db.query(Subscription).filter(Subscription.organization_id == org.id).first()
        if sub and sub.plan_id:
            p = next((p for p in plans if p.id == sub.plan_id), None)
            if p:
                plan_name = p.name
        elif org.plan_id:
            p = next((p for p in plans if p.id == org.plan_id), None)
            if p:
                plan_name = p.name
        plan_distribution[plan_name] = plan_distribution.get(plan_name, 0) + 1
    return PlatformStats(
        total_organizations=total_orgs,
        active_organizations=active_orgs,
        trial_organizations=db.query(Organization).filter(Organization.status == "trial").count(),
        total_users=total_users,
        total_devices=total_devices,
        total_checks=db.query(DeviceCheck).count(),
        total_check_results=db.query(CheckResult).count(),
        active_alerts=alerts_24h,
        system_uptime_seconds=0.0,
        ai_requests_total=insights,
        subscription_revenue=revenue,
        plan_distribution=plan_distribution,
    )


@router.get("/organizations")
def list_orgs(search: Optional[str] = None, limit: int = 100, offset: int = 0, db: Session = Depends(get_db)):
    query = db.query(Organization)
    if search:
        like = f"%{search}%"
        query = query.filter(Organization.name.ilike(like) | Organization.slug.ilike(like))
    orgs = query.order_by(Organization.created_at.desc()).offset(offset).limit(limit).all()
    out = []
    for org in orgs:
        sub = db.query(Subscription).filter(Subscription.organization_id == org.id).first()
        plan = db.query(Plan).filter(Plan.id == (sub.plan_id if sub else org.plan_id)).first()
        device_count = db.query(Device).filter(Device.organization_id == org.id).count()
        user_count = db.query(User).filter(User.organization_id == org.id).count()
        out.append({
            "id": org.id, "name": org.name, "slug": org.slug, "status": org.status,
            "plan": plan.name if plan else "free", "devices": device_count, "users": user_count,
            "created_at": org.created_at,
        })
    return out


@router.post("/organizations", response_model=dict)
def create_org(name: str, slug: str, plan_slug: str = "free", db: Session = Depends(get_db)):
    existing = db.query(Organization).filter(Organization.slug == slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Organization slug already exists")
    org = Organization(name=name, slug=slug, status="active")
    db.add(org)
    db.flush()
    plan = billing_service.get_plan_by_slug(db, plan_slug)
    sub = Subscription(
        organization_id=org.id,
        plan_id=plan.id if plan else None,
        status="active",
        billing_cycle="monthly",
        started_at=utcnow(),
        expires_at=utcnow() + timedelta(days=365),
    )
    db.add(sub)
    db.commit()
    return {"id": org.id, "name": org.name, "slug": org.slug}


@router.patch("/organizations/{org_id}/status", response_model=dict)
def set_org_status(org_id: int, status: str, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    if status not in ("active", "suspended", "cancelled"):
        raise HTTPException(status_code=422, detail="Status must be active, suspended or cancelled")
    org.status = status
    db.commit()
    return {"id": org.id, "status": org.status}


@router.get("/organizations/{org_id}/users")
def list_org_users(org_id: int, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    out = []
    for u in users_service.list_org_users(db, org_id):
        out.append({
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
        })
    return out


@router.post("/organizations/{org_id}/users", response_model=Message)
def create_org_user(org_id: int, body: UserCreate, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    if body.role_id is not None:
        role = users_service.get_role_by_id(db, body.role_id)
        if role is None or role.scope != "organization":
            raise HTTPException(status_code=400, detail="Invalid role")
    sub = db.query(Subscription).filter(Subscription.organization_id == org_id).first()
    plan = db.query(Plan).filter(Plan.id == (sub.plan_id if sub else org.plan_id)).first()
    user = users_service.create_user(
        db, org_id, body.username, body.email, body.password, body.role_id,
        full_name=body.full_name, plan_max_users=plan.max_users if plan else 5,
    )
    log_action(db, "user.create", "user", str(user.id), organization_id=org_id)
    db.commit()
    return Message(message=f"User {body.username} created in {org.name}")


@router.patch("/organizations/{org_id}/users/{user_id}", response_model=Message)
def update_org_user(org_id: int, user_id: int, body: UserUpdate, db: Session = Depends(get_db)):
    if db.query(Organization).filter(Organization.id == org_id).first() is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    users_service.update_org_user(db, org_id, user_id, **body.model_dump(exclude_unset=True))
    log_action(db, "user.update", "user", str(user_id), organization_id=org_id)
    db.commit()
    return Message(message="User updated")


@router.delete("/organizations/{org_id}/users/{user_id}", response_model=Message)
def delete_org_user(org_id: int, user_id: int, auth: AuthContext = Depends(get_auth_context), db: Session = Depends(get_db)):
    if db.query(Organization).filter(Organization.id == org_id).first() is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    users_service.delete_org_user(db, org_id, user_id, auth.user)
    log_action(db, "user.delete", "user", str(user_id), organization_id=org_id)
    db.commit()
    return Message(message="User deleted")


@router.get("/plans", response_model=list[PlanOut])
def list_plans(db: Session = Depends(get_db)):
    return db.query(Plan).order_by(Plan.price).all()


@router.post("/plans", response_model=dict)
def create_plan(body: PlanCreate, db: Session = Depends(get_db)):
    plan = billing_service.create_plan(db, body.model_dump())
    return {"id": plan.id, "name": plan.name, "slug": plan.slug}


@router.patch("/plans/{plan_id}", response_model=dict)
def update_plan(plan_id: int, body: PlanUpdate, db: Session = Depends(get_db)):
    plan = billing_service.update_plan(db, plan_id, body.model_dump(exclude_unset=True))
    return {"id": plan.id, "name": plan.name, "slug": plan.slug}


@router.get("/audit-logs")
def platform_audit_logs(limit: int = 100, offset: int = 0, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
    return [
        {"id": l.id, "action": l.action, "resource": l.resource, "resource_id": l.resource_id,
         "organization_id": l.organization_id, "user_name": l.user_name, "ip_address": l.ip_address,
         "created_at": l.created_at}
        for l in logs
    ]


@router.get("/api-keys")
def list_all_keys(db: Session = Depends(get_db)):
    keys = db.query(ApiKey).filter(ApiKey.revoked_at.is_(None)).order_by(ApiKey.created_at.desc()).limit(100).all()
    return [
        {"id": k.id, "name": k.name, "key_prefix": k.key_prefix, "organization_id": k.organization_id,
         "scopes": k.scopes, "last_used_at": k.last_used_at, "created_at": k.created_at}
        for k in keys
    ]


@router.get("/settings")
def platform_settings(db: Session = Depends(get_db)):
    from models import Setting

    rows = db.query(Setting).filter(Setting.organization_id.is_(None)).all()
    return {r.key: r.value for r in rows}


@router.put("/settings")
def update_settings(body: SettingUpdate, db: Session = Depends(get_db)):
    from models import Setting

    for key, value in body.model_dump(exclude_unset=True).items():
        row = db.query(Setting).filter(Setting.organization_id.is_(None), Setting.key == key).first()
        if row:
            row.value = str(value)
        else:
            db.add(Setting(key=key, value=str(value)))
    db.commit()
    return Message(message="Settings updated")
