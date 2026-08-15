"""Report endpoints: generate CSV/XLSX/PDF reports (org-scoped)."""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from core.dependencies import AuthContext, get_auth_context, get_db, require_permission
from models import Organization
from reports import service as reports_service
from tenants.service import get_org_plan, get_organization

router = APIRouter(prefix="/reports", tags=["reports"])

reports_perm = require_permission("reports.view")


def _org(db: Session, auth: AuthContext) -> Organization:
    if auth.org_id is None:
        raise HTTPException(status_code=400, detail="No organization context")
    return get_organization(db, auth.org_id)


def _parse_dates(from_date: Optional[str], to_date: Optional[str]) -> tuple[datetime, datetime]:
    try:
        if from_date:
            start = datetime.strptime(from_date, "%Y-%m-%d")
        else:
            start = datetime.utcnow() - timedelta(days=30)
        if to_date:
            end = datetime.strptime(to_date, "%Y-%m-%d") + timedelta(days=1)
        else:
            end = datetime.utcnow()
        return start, end
    except ValueError:
        raise HTTPException(status_code=422, detail="Dates must be YYYY-MM-DD")


@router.get("/{report_type}")
def generate(report_type: str, fmt: str = "csv", from_date: Optional[str] = None,
             to_date: Optional[str] = None, auth=Depends(reports_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    plan = get_org_plan(db, org)
    if not plan.advanced_reports_enabled:
        raise HTTPException(status_code=403, detail="Advanced reports not included in your plan")
    start, end = _parse_dates(from_date, to_date)
    if report_type not in reports_service.REPORT_TYPES:
        raise HTTPException(status_code=422, detail=f"Unknown report type. Valid: {sorted(reports_service.REPORT_TYPES)}")
    content = reports_service.generate_report(db, org.id, report_type, fmt, start, end, org_name=org.name)
    media_types = {"csv": "text/csv", "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                   "pdf": "application/pdf"}
    return Response(
        content=content,
        media_type=media_types.get(fmt, "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{reports_service.report_filename(report_type, fmt)}"'},
    )
