"""Billing endpoints: plans, subscription, usage."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from billing import service as billing_service
from core.dependencies import AuthContext, get_auth_context, get_db
from models import Organization
from schemas import Message, PlanOut, SubscribeRequest, SubscriptionOut, UsageOut
from tenants import service as tenants_service
from tenants.service import get_organization

router = APIRouter(prefix="/billing", tags=["billing"])


def _org(db: Session, auth: AuthContext) -> Organization:
    if auth.org_id is None:
        raise HTTPException(status_code=400, detail="No organization context")
    return get_organization(db, auth.org_id)


@router.get("/plans", response_model=list[PlanOut])
def list_plans(db: Session = Depends(get_db)):
    return billing_service.list_plans(db)


@router.get("/subscription", response_model=SubscriptionOut)
def current_subscription(auth=Depends(get_auth_context), db: Session = Depends(get_db)):
    org = _org(db, auth)
    sub = tenants_service.get_subscription(db, org.id)
    if sub is None:
        raise HTTPException(status_code=404, detail="No subscription")
    return sub


@router.post("/subscribe", response_model=SubscriptionOut)
def subscribe(body: SubscribeRequest, auth=Depends(get_auth_context), db: Session = Depends(get_db)):
    org = _org(db, auth)
    sub = billing_service.subscribe(db, org.id, body.plan_slug, body.billing_cycle)
    return sub


@router.post("/cancel", response_model=Message)
def cancel(auth=Depends(get_auth_context), db: Session = Depends(get_db)):
    org = _org(db, auth)
    billing_service.cancel_subscription(db, org.id)
    return Message(message="Subscription cancelled")


@router.get("/usage", response_model=list[UsageOut])
def usage(auth=Depends(get_auth_context), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return tenants_service.get_usage(db, org.id)
