"""AI request usage tracking and per-organization quota enforcement."""
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.security import utcnow
from models import AIUsage


def record_request(db: Session, organization_id: int) -> dict:
    period = utcnow().strftime("%Y-%m")
    row = db.query(AIUsage).filter(AIUsage.organization_id == organization_id, AIUsage.period == period).first()
    if row is None:
        row = AIUsage(organization_id=organization_id, period=period, requests=0)
        db.add(row)
    row.requests += 1
    db.commit()
    return {"period": period, "requests": row.requests}


def enforce_quota(db: Session, organization_id: int, monthly_limit: int) -> None:
    if monthly_limit <= 0:
        return
    period = utcnow().strftime("%Y-%m")
    row = db.query(AIUsage).filter(AIUsage.organization_id == organization_id, AIUsage.period == period).first()
    used = row.requests if row else 0
    if used >= monthly_limit:
        raise HTTPException(
            status_code=429,
            detail=f"AI request quota exceeded for this month ({monthly_limit}). Upgrade your plan for more AI requests.",
        )


def get_monthly_usage(db: Session, organization_id: int) -> int:
    period = utcnow().strftime("%Y-%m")
    row = db.query(AIUsage).filter(AIUsage.organization_id == organization_id, AIUsage.period == period).first()
    return row.requests if row else 0
