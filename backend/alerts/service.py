"""Alert engine: rule evaluation, deduplication, cooldown, escalation, notifications."""
import logging
from datetime import timedelta
from typing import Optional

from sqlalchemy.orm import Session

from core.security import utcnow
from database.session import SessionLocal
from models import AlertLog, AlertRule, CheckResult, Device, DeviceCheck, InAppNotification
from notifications.service import deliver_alert, get_org_user_ids

logger = logging.getLogger(__name__)

COOLDOWN_SECONDS = 300  # default dedup window when rule has no cooldown set


def evaluate_alerts_for_org(db: Session, organization_id: int) -> int:
    """Evaluates all enabled rules for one organization. Returns number of alerts raised."""
    rules = (
        db.query(AlertRule)
        .filter(AlertRule.organization_id == organization_id, AlertRule.enabled.is_(True))
        .all()
    )
    raised = 0
    for rule in rules:
        try:
            if _evaluate_rule(db, rule):
                raised += 1
        except Exception as e:
            logger.exception(f"Alert rule {rule.id} evaluation failed: {e}")
            db.rollback()
    return raised


def _target_devices(db: Session, rule: AlertRule) -> list[Device]:
    if rule.target_type == "device":
        device = db.query(Device).filter(Device.id == rule.target_id, Device.organization_id == rule.organization_id).first()
        return [device] if device else []
    if rule.target_type == "group":
        return db.query(Device).filter(Device.group_id == rule.target_id, Device.organization_id == rule.organization_id).all()
    return db.query(Device).filter(Device.organization_id == rule.organization_id).all()


def _evaluate_rule(db: Session, rule: AlertRule) -> bool:
    devices = _target_devices(db, rule)
    if not devices:
        return False
    device_ids = [d.id for d in devices]
    triggered: list[tuple[Device, Optional[CheckResult]]] = []

    if rule.rule_type == "device_offline":
        triggered = [(d, None) for d in devices if d.status == "Offline"]
    elif rule.rule_type == "device_online":
        triggered = [(d, None) for d in devices if d.status == "Online"]
    elif rule.rule_type == "high_latency":
        for d in devices:
            if d.latency is not None and rule.threshold_value is not None and d.latency > rule.threshold_value:
                triggered.append((d, None))
    elif rule.rule_type in ("packet_loss", "http_failure", "port_down", "ssl_expiry", "repeated_failure"):
        recent = (
            db.query(CheckResult)
            .filter(CheckResult.device_id.in_(device_ids), CheckResult.organization_id == rule.organization_id)
            .order_by(CheckResult.timestamp.desc())
            .limit(len(devices) * 10)
            .all()
        )
        latest_by_device: dict[int, CheckResult] = {}
        for r in recent:
            latest_by_device.setdefault(r.device_id, r)
        if rule.rule_type == "port_down":
            triggered = [(d, latest_by_device.get(d.id)) for d in devices
                         if latest_by_device.get(d.id) and latest_by_device[d.id].check_type == "tcp" and latest_by_device[d.id].status == "Offline"]
        elif rule.rule_type == "http_failure":
            triggered = [(d, latest_by_device.get(d.id)) for d in devices
                         if latest_by_device.get(d.id) and latest_by_device[d.id].check_type == "http" and latest_by_device[d.id].status == "Offline"]
        elif rule.rule_type == "packet_loss":
            triggered = [(d, latest_by_device.get(d.id)) for d in devices
                         if latest_by_device.get(d.id) and latest_by_device[d.id].packet_loss is not None
                         and rule.threshold_value is not None and latest_by_device[d.id].packet_loss > rule.threshold_value]
        elif rule.rule_type == "repeated_failure":
            for d in devices:
                check = db.query(DeviceCheck).filter(DeviceCheck.device_id == d.id).first()
                if check and check.consecutive_failures >= (rule.threshold_value or 3):
                    triggered.append((d, None))

    if not triggered:
        return False

    # Cooldown / deduplication
    last_log = (
        db.query(AlertLog)
        .filter(AlertLog.rule_id == rule.id)
        .order_by(AlertLog.created_at.desc())
        .first()
    )
    if last_log:
        cooldown = timedelta(minutes=rule.cooldown_minutes or 5)
        if (utcnow() - last_log.created_at) < cooldown:
            return False

    names = ", ".join(d.name for d, _ in triggered[:5])
    if len(triggered) > 5:
        names += f" and {len(triggered) - 5} more"

    messages = {
        "device_offline": f"Device(s) offline: {names}",
        "device_online": f"Device(s) came online: {names}",
        "high_latency": f"High latency detected on: {names} (threshold: {rule.threshold_value}ms)",
        "packet_loss": f"Packet loss detected on: {names} (threshold: {rule.threshold_value}%)",
        "port_down": f"Port down on: {names}",
        "http_failure": f"HTTP failure on: {names}",
        "ssl_expiry": f"SSL certificate expiring soon: {names}",
        "repeated_failure": f"Repeated failures on: {names}",
    }
    message = messages.get(rule.rule_type, f"Alert triggered: {names}")
    severity = rule.severity or ("critical" if rule.rule_type in ("device_offline", "port_down") else "warning")

    user_ids = get_org_user_ids(db, rule.organization_id)
    device_ids_for_log = list({d.id for d, _ in triggered[:1]})
    device_id = device_ids_for_log[0] if device_ids_for_log else None

    sent = deliver_alert(
        db,
        rule.organization_id,
        rule.name,
        message,
        severity,
        rule.channels or ["in_app"],
        org_user_ids=user_ids,
    )

    log = AlertLog(
        organization_id=rule.organization_id,
        rule_id=rule.id,
        device_id=device_id,
        message=message,
        severity=severity,
        sent_channels=sent,
    )
    db.add(log)
    db.commit()
    return True


def evaluate_all_organizations() -> int:
    """Background job: evaluates alerts for every organization."""
    from models import Organization

    db = SessionLocal()
    total = 0
    try:
        org_ids = [o.id for o in db.query(Organization).all()]
        for org_id in org_ids:
            total += evaluate_alerts_for_org(db, org_id)
            db.commit()
        return total
    finally:
        db.close()


# ─── Alert rule / log helpers (org-scoped) ─────────────────────
def list_rules(db: Session, organization_id: int) -> list[AlertRule]:
    return (
        db.query(AlertRule)
        .filter(AlertRule.organization_id == organization_id)
        .order_by(AlertRule.created_at.desc())
        .all()
    )


def get_rule(db: Session, organization_id: int, rule_id: int) -> AlertRule:
    from fastapi import HTTPException

    rule = db.query(AlertRule).filter(AlertRule.id == rule_id, AlertRule.organization_id == organization_id).first()
    if rule is None:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    return rule


def create_rule(db: Session, organization_id: int, data: dict) -> AlertRule:
    clean = {k: v for k, v in data.items() if k in AlertRule.__table__.columns and v is not None}
    rule = AlertRule(organization_id=organization_id, **clean)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def update_rule(db: Session, organization_id: int, rule_id: int, data: dict) -> AlertRule:
    rule = get_rule(db, organization_id, rule_id)
    for key, value in data.items():
        if value is not None and key in AlertRule.__table__.columns:
            setattr(rule, key, value)
    db.commit()
    db.refresh(rule)
    return rule


def delete_rule(db: Session, organization_id: int, rule_id: int) -> None:
    rule = get_rule(db, organization_id, rule_id)
    db.delete(rule)
    db.commit()


def list_logs(db: Session, organization_id: int, status_filter: Optional[str] = None,
              severity: Optional[str] = None, limit: int = 100, offset: int = 0) -> tuple[list[AlertLog], int]:
    query = db.query(AlertLog).filter(AlertLog.organization_id == organization_id)
    if status_filter:
        query = query.filter(AlertLog.status == status_filter)
    if severity:
        query = query.filter(AlertLog.severity == severity)
    total = query.count()
    logs = query.order_by(AlertLog.created_at.desc()).offset(offset).limit(limit).all()
    return logs, total


def clear_logs(db: Session, organization_id: int) -> int:
    log_ids = [l.id for l in db.query(AlertLog).filter(AlertLog.organization_id == organization_id).all()]
    if log_ids:
        db.query(InAppNotification).filter(InAppNotification.alert_id.in_(log_ids)).update(
            {"alert_id": None}, synchronize_session=False
        )
    count = (
        db.query(AlertLog)
        .filter(AlertLog.organization_id == organization_id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return count


def act_on_log(db: Session, organization_id: int, log_id: int, action: str, user_id: int) -> AlertLog:
    from fastapi import HTTPException

    log = db.query(AlertLog).filter(AlertLog.id == log_id, AlertLog.organization_id == organization_id).first()
    if log is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    if action == "acknowledge":
        log.status = "acknowledged"
        log.acknowledged_by = user_id
        log.acknowledged_at = utcnow()
    elif action == "resolve":
        log.status = "resolved"
        log.resolved_by = user_id
        log.resolved_at = utcnow()
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    db.commit()
    db.refresh(log)
    return log


# ─── Notification config ───────────────────────────────────────
def get_config(db: Session, organization_id: int) -> dict:
    from notifications.service import get_org_config

    cfg = get_org_config(db, organization_id)
    return {
        "email_recipients": cfg.get("email_recipients", ""),
        "slack_webhook_url": cfg.get("slack_webhook_url", ""),
        "teams_webhook_url": cfg.get("teams_webhook_url", ""),
        "webhook_url": cfg.get("webhook_url", ""),
        "smtp_configured": bool(cfg.get("smtp_configured")),
        "slack_configured": bool(cfg.get("slack_configured")),
        "teams_configured": bool(cfg.get("teams_configured")),
        "webhook_configured": bool(cfg.get("webhook_configured")),
    }


def update_config(db: Session, organization_id: int, data: dict) -> dict:
    from notifications.service import set_org_config

    for key in ("email_recipients", "slack_webhook_url", "teams_webhook_url", "webhook_url"):
        if data.get(key) is not None:
            set_org_config(db, organization_id, key, str(data[key]))
    return get_config(db, organization_id)


def test_delivery(db: Session, organization_id: int, channel: str) -> dict:
    try:
        sent = deliver_alert(
            db,
            organization_id,
            rule_name="Test notification",
            message="This is a test notification from NetPulse.",
            severity="info",
            channels=[channel],
            org_user_ids=get_org_user_ids(db, organization_id),
        )
        return {"success": channel in sent, "channel": channel,
                "message": "Test sent" if channel in sent else "Channel not configured or failed"}
    except Exception as e:
        return {"success": False, "channel": channel, "message": str(e)[:200]}


# ─── In-app notifications ──────────────────────────────────────
def list_notifications(db: Session, organization_id: int, unread_only: bool = False,
                       limit: int = 50) -> list[InAppNotification]:
    query = db.query(InAppNotification).filter(InAppNotification.organization_id == organization_id)
    if unread_only:
        query = query.filter(InAppNotification.read_at.is_(None))
    return query.order_by(InAppNotification.created_at.desc()).limit(limit).all()


def mark_notification_read(db: Session, organization_id: int, notification_id: int) -> InAppNotification:
    from fastapi import HTTPException

    n = db.query(InAppNotification).filter(
        InAppNotification.id == notification_id,
        InAppNotification.organization_id == organization_id,
    ).first()
    if n is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.read_at = utcnow()
    db.commit()
    db.refresh(n)
    return n


def mark_all_notifications_read(db: Session, organization_id: int) -> int:
    count = (
        db.query(InAppNotification)
        .filter(InAppNotification.organization_id == organization_id, InAppNotification.read_at.is_(None))
        .update({"read_at": utcnow()}, synchronize_session=False)
    )
    db.commit()
    return count
