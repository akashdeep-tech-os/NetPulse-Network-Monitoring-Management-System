"""Billing service: plans and subscriptions. Designed so Stripe can be integrated later."""
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.security import utcnow
from models import Organization, Plan, Subscription


def list_plans(db: Session) -> list[Plan]:
    return db.query(Plan).filter(Plan.is_active.is_(True)).order_by(Plan.price).all()


def get_plan_by_slug(db: Session, slug: str) -> Plan:
    plan = db.query(Plan).filter(Plan.slug == slug).first()
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


def get_plan_by_id(db: Session, plan_id: int) -> Plan:
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


def create_plan(db: Session, data: dict) -> Plan:
    if db.query(Plan).filter(Plan.slug == data["slug"]).first():
        raise HTTPException(status_code=400, detail="Plan slug already exists")
    plan = Plan(**data)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def update_plan(db: Session, plan_id: int, data: dict) -> Plan:
    plan = get_plan_by_id(db, plan_id)
    for key, value in data.items():
        if value is not None and hasattr(plan, key):
            setattr(plan, key, value)
    db.commit()
    db.refresh(plan)
    return plan


def subscribe(db: Session, organization: Organization, plan_slug: str, billing_cycle: str = "monthly") -> Subscription:
    plan = get_plan_by_slug(db, plan_slug)
    sub = db.query(Subscription).filter(Subscription.organization_id == organization.id).first()
    trial_ends = None
    if sub is None or sub.status == "trial":
        trial_ends = utcnow() + timedelta(days=14)

    if sub is None:
        sub = Subscription(
            organization_id=organization.id,
            plan_id=plan.id,
            status="active",
            billing_cycle=billing_cycle,
            trial_ends_at=trial_ends,
            expires_at=(utcnow() + timedelta(days=30)),
        )
        db.add(sub)
    else:
        sub.plan_id = plan.id
        sub.billing_cycle = billing_cycle
        sub.status = "active"
        sub.trial_ends_at = trial_ends
        sub.expires_at = utcnow() + timedelta(days=30)
    organization.plan_id = plan.id
    db.commit()
    db.refresh(sub)
    return sub


def cancel_subscription(db: Session, organization: Organization) -> Subscription:
    sub = db.query(Subscription).filter(Subscription.organization_id == organization.id).first()
    if sub is None:
        raise HTTPException(status_code=404, detail="No active subscription")
    sub.status = "canceled"
    sub.expires_at = utcnow()
    db.commit()
    db.refresh(sub)
    return sub


def current_subscription(db: Session, organization: Organization) -> Subscription:
    sub = db.query(Subscription).filter(Subscription.organization_id == organization.id).first()
    if sub is None:
        free_plan = db.query(Plan).filter(Plan.slug == "free").first()
        if free_plan is None:
            raise HTTPException(status_code=500, detail="No subscription plans configured")
        sub = Subscription(
            organization_id=organization.id,
            plan_id=free_plan.id,
            status="active",
            billing_cycle="monthly",
            expires_at=utcnow() + timedelta(days=365),
        )
        db.add(sub)
        organization.plan_id = free_plan.id
        db.commit()
        db.refresh(sub)
    return sub
