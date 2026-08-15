"""Alert endpoints: rules, logs, config, test, in-app notifications."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from alerts import service as alerts_service
from core.dependencies import AuthContext, get_auth_context, get_db, require_permission
from models import Organization
from schemas import (
    AlertLogOut,
    AlertRuleCreate,
    AlertRuleOut,
    AlertRuleUpdate,
    Message,
    NotifConfigOut,
    NotifConfigUpdate,
    NotificationTestRequest,
)
from tenants.service import get_organization

router = APIRouter(prefix="/alerts", tags=["alerts"])

alerts_perm = require_permission("alerts.view")
alerts_manage = require_permission("alerts.manage")


def _org(db: Session, auth: AuthContext) -> Organization:
    if auth.org_id is None:
        raise HTTPException(status_code=400, detail="No organization context")
    return get_organization(db, auth.org_id)


# ─── Rules ─────────────────────────────────────────────────────
@router.get("/rules", response_model=list[AlertRuleOut])
def list_rules(auth=Depends(alerts_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return alerts_service.list_rules(db, org.id)


@router.post("/rules", response_model=AlertRuleOut)
def create_rule(body: AlertRuleCreate, auth=Depends(alerts_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return alerts_service.create_rule(db, org.id, body.model_dump())


@router.patch("/rules/{rule_id}", response_model=AlertRuleOut)
def update_rule(rule_id: int, body: AlertRuleUpdate, auth=Depends(alerts_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return alerts_service.update_rule(db, org.id, rule_id, body.model_dump(exclude_unset=True))


@router.delete("/rules/{rule_id}", response_model=Message)
def delete_rule(rule_id: int, auth=Depends(alerts_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    alerts_service.delete_rule(db, org.id, rule_id)
    return Message(message="Rule deleted")


@router.post("/rules/test", response_model=dict)
def test_rule(body: NotificationTestRequest, auth=Depends(alerts_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return alerts_service.test_delivery(db, org.id, body.channel)


# ─── Logs ──────────────────────────────────────────────────────
@router.get("/logs")
def list_logs(status: Optional[str] = None, severity: Optional[str] = None,
              limit: int = 100, offset: int = 0,
              auth=Depends(alerts_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    logs, total = alerts_service.list_logs(db, org.id, status_filter=status, severity=severity,
                                           limit=limit, offset=offset)
    return {"total": total, "logs": [AlertLogOut.model_validate(l) for l in logs]}


@router.patch("/logs/{log_id}/acknowledge", response_model=dict)
def acknowledge_log(log_id: int, auth=Depends(alerts_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    log = alerts_service.act_on_log(db, org.id, log_id, "acknowledge", auth.user.id if auth.user else 0)
    return {"id": log.id, "status": log.status}


@router.patch("/logs/{log_id}/resolve", response_model=dict)
def resolve_log(log_id: int, auth=Depends(alerts_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    log = alerts_service.act_on_log(db, org.id, log_id, "resolve", auth.user.id if auth.user else 0)
    return {"id": log.id, "status": log.status}


@router.delete("/logs", response_model=Message)
def clear_logs(auth=Depends(alerts_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    alerts_service.clear_logs(db, org.id)
    return Message(message="Alert logs cleared")


# ─── Config (notification channels) ────────────────────────────
@router.get("/config", response_model=NotifConfigOut)
def get_config(auth=Depends(alerts_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return alerts_service.get_config(db, org.id)


@router.put("/config", response_model=NotifConfigOut)
def update_config(body: NotifConfigUpdate, auth=Depends(alerts_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return alerts_service.update_config(db, org.id, body.model_dump(exclude_unset=True))


# ─── In-app notifications ──────────────────────────────────────
@router.get("/notifications")
def list_notifications(unread_only: bool = False, auth=Depends(get_auth_context), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return [
        {"id": n.id, "title": n.title, "message": n.message, "severity": n.severity,
         "read": n.read_at is not None, "created_at": n.created_at}
        for n in alerts_service.list_notifications(db, org.id, unread_only=unread_only)
    ]


@router.patch("/notifications/{notification_id}/read", response_model=dict)
def mark_notification_read(notification_id: int, auth=Depends(get_auth_context), db: Session = Depends(get_db)):
    org = _org(db, auth)
    alerts_service.mark_notification_read(db, org.id, notification_id)
    return {"id": notification_id, "read": True}


@router.post("/notifications/read-all", response_model=Message)
def mark_all_read(auth=Depends(get_auth_context), db: Session = Depends(get_db)):
    org = _org(db, auth)
    alerts_service.mark_all_notifications_read(db, org.id)
    return Message(message="All notifications marked read")
