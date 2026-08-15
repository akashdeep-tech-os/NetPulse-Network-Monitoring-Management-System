"""Analytics endpoints: KPIs, health score, charts, dashboard, problem devices."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from analytics import service as analytics_service
from core.dependencies import AuthContext, get_auth_context, get_db, require_permission
from models import Organization
from schemas import DashboardOut, Kpis, HealthScore
from tenants.service import get_organization

router = APIRouter(prefix="/analytics", tags=["analytics"])

analytics_perm = require_permission("monitoring.view")


def _org(db: Session, auth: AuthContext) -> Organization:
    if auth.org_id is None:
        raise HTTPException(status_code=400, detail="No organization context")
    return get_organization(db, auth.org_id)


@router.get("/kpis", response_model=Kpis)
def kpis(auth=Depends(analytics_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return analytics_service.get_kpis(db, org.id)


@router.get("/health-score", response_model=HealthScore)
def health_score(auth=Depends(analytics_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return analytics_service.get_health_score(db, org.id)


@router.get("/charts")
def charts(hours: int = 24, auth=Depends(analytics_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return analytics_service.get_chart_data(db, org.id, hours=hours)


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(hours: int = 24, auth=Depends(analytics_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return analytics_service.get_dashboard_data(db, org.id, hours=hours)


@router.get("/problem-devices")
def problem_devices(hours: int = 24, limit: int = 5, auth=Depends(analytics_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return analytics_service.get_top_problem_devices(db, org.id, hours=hours, limit=limit)


@router.get("/downtime")
def downtime(hours: int = 24, auth=Depends(analytics_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return analytics_service.downtime_stats(db, org.id, hours=hours)


@router.get("/settings")
def get_settings(auth=Depends(analytics_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return analytics_service.get_org_settings(db, org.id)


@router.put("/settings")
def set_settings(weight_availability: Optional[float] = None, weight_latency: Optional[float] = None,
                 weight_packet_loss: Optional[float] = None, weight_stability: Optional[float] = None,
                 auth=Depends(require_permission("settings.manage")), db: Session = Depends(get_db)):
    org = _org(db, auth)
    updates = {k: v for k, v in {"health_score_weight_availability": weight_availability,
                                 "health_score_weight_latency": weight_latency,
                                 "health_score_weight_packet_loss": weight_packet_loss,
                                 "health_score_weight_stability": weight_stability}.items() if v is not None}
    for key, value in updates.items():
        analytics_service.set_org_setting(db, org.id, key, str(value))
    return analytics_service.get_org_settings(db, org.id)
