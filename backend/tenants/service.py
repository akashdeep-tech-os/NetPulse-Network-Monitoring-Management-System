"""Tenant (organization) service: profile, usage limits, subscription."""
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.security import utcnow
from models import ApiKey, Device, DeviceGroup, Organization, Plan, Subscription, User


def get_organization(db: Session, organization_id: int) -> Organization:
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


def get_org_plan(db: Session, organization: Organization) -> Plan:
    if organization.plan_id is not None:
        return db.query(Plan).filter(Plan.id == organization.plan_id).first() or default_plan(db)
    sub = db.query(Subscription).filter(Subscription.organization_id == organization.id).first()
    if sub:
        return db.query(Plan).filter(Plan.id == sub.plan_id).first() or default_plan(db)
    return default_plan(db)


def default_plan(db: Session) -> Plan:
    plan = db.query(Plan).filter(Plan.slug == "free").first()
    if plan:
        return plan
    plans = db.query(Plan).order_by(Plan.price).first()
    if plans:
        return plans
    raise HTTPException(status_code=500, detail="No subscription plans configured")


def get_subscription(db: Session, organization_id: int) -> Subscription:
    sub = db.query(Subscription).filter(Subscription.organization_id == organization_id).first()
    if sub is None:
        plan = default_plan(db)
        sub = Subscription(
            organization_id=organization_id,
            plan_id=plan.id,
            status="trial",
            billing_cycle="monthly",
            trial_ends_at=utcnow() + timedelta(days=14),
            expires_at=utcnow() + timedelta(days=14),
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
    return sub


def get_usage(db: Session, organization_id: int) -> list[dict]:
    plan = get_org_plan(db, get_organization(db, organization_id))

    def pct(used: int, limit: int) -> float:
        return round((used / limit * 100), 1) if limit else 0

    devices = db.query(Device).filter(Device.organization_id == organization_id).count()
    users = db.query(User).filter(User.organization_id == organization_id).count()
    groups = db.query(DeviceGroup).filter(DeviceGroup.organization_id == organization_id).count()
    api_keys = db.query(ApiKey).filter(ApiKey.organization_id == organization_id, ApiKey.revoked_at.is_(None)).count()

    from models import AIUsage

    period = utcnow().strftime("%Y-%m")
    ai = db.query(AIUsage).filter(AIUsage.organization_id == organization_id, AIUsage.period == period).first()
    ai_requests = ai.requests if ai else 0

    return [
        {"resource": "devices", "used": devices, "limit": plan.max_devices, "percent": pct(devices, plan.max_devices)},
        {"resource": "users", "used": users, "limit": plan.max_users, "percent": pct(users, plan.max_users)},
        {"resource": "groups", "used": groups, "limit": plan.max_groups, "percent": pct(groups, plan.max_groups)},
        {"resource": "api_keys", "used": api_keys, "limit": plan.max_api_keys, "percent": pct(api_keys, plan.max_api_keys)},
        {"resource": "ai_requests", "used": ai_requests, "limit": plan.ai_requests_per_month, "percent": pct(ai_requests, plan.ai_requests_per_month)},
    ]


def enforce_limit(db: Session, organization_id: int, resource: str, limit: int, label: str) -> None:
    from models import ApiKey, Device, DeviceGroup, User

    model = {"devices": Device, "users": User, "groups": DeviceGroup, "api_keys": ApiKey}.get(resource)
    if model is None:
        return
    query = db.query(model).filter(model.organization_id == organization_id)
    if resource == "api_keys":
        query = query.filter(ApiKey.revoked_at.is_(None))
    if query.count() >= limit:
        raise HTTPException(
            status_code=400,
            detail=f"{label} limit reached ({limit}). Upgrade your plan for more.",
        )


def update_organization(db: Session, organization_id: int, **fields) -> Organization:
    org = get_organization(db, organization_id)
    for key, value in fields.items():
        if value is not None and hasattr(org, key):
            setattr(org, key, value)
    db.commit()
    db.refresh(org)
    return org
