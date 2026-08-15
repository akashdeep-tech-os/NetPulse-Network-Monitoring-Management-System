"""Notification delivery: Email (SMTP), Slack, Microsoft Teams, generic Webhook, in-app."""
import json
import logging
import smtplib
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from sqlalchemy.orm import Session

from core.config import settings
from models import AlertConfig, InAppNotification, User

logger = logging.getLogger(__name__)


def get_org_config(db: Session, organization_id: int) -> dict:
    """Returns per-organization notification config merged with environment defaults."""
    rows = db.query(AlertConfig).filter(AlertConfig.organization_id == organization_id).all()
    values = {r.key: r.value or "" for r in rows}
    return {
        "email_recipients": values.get("email_recipients", ""),
        "slack_webhook_url": values.get("slack_webhook_url", settings.SLACK_WEBHOOK_URL),
        "teams_webhook_url": values.get("teams_webhook_url", ""),
        "webhook_url": values.get("webhook_url", ""),
    }


def set_org_config(db: Session, organization_id: int, key: str, value: str) -> None:
    row = (
        db.query(AlertConfig)
        .filter(AlertConfig.organization_id == organization_id, AlertConfig.key == key)
        .first()
    )
    if row:
        row.value = value
    else:
        db.add(AlertConfig(organization_id=organization_id, key=key, value=value))
    db.commit()


def send_email(subject: str, body_html: str, recipients: list[str]) -> bool:
    if not settings.SMTP_HOST or not settings.SMTP_USERNAME:
        logger.warning("Email not configured")
        return False
    recipients = [r for r in recipients if r]
    if not recipients:
        logger.warning("No email recipients")
        return False
    try:
        msg = MIMEMultipart()
        msg["From"] = settings.SMTP_FROM or settings.SMTP_USERNAME
        msg["To"] = ", ".join(recipients)
        msg["Subject"] = subject
        msg.attach(MIMEText(body_html, "html"))
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(msg["From"], recipients, msg.as_string())
        return True
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return False


def send_slack(message: str, webhook_url: Optional[str] = None) -> bool:
    url = webhook_url or settings.SLACK_WEBHOOK_URL
    if not url:
        return False
    return _post_webhook(url, {"text": message, "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": message}}]})


def send_teams(message: str, webhook_url: Optional[str] = None) -> bool:
    if not webhook_url:
        return False
    return _post_webhook(
        webhook_url,
        {"text": message, "sections": [{"activityTitle": "NetPulse Alert", "facts": [{"name": "Message", "value": message}]}]},
    )


def send_webhook(message: str, webhook_url: Optional[str] = None) -> bool:
    if not webhook_url:
        return False
    return _post_webhook(webhook_url, {"text": message, "event": "alert", "severity": "unknown"})


def _post_webhook(url: str, payload: dict) -> bool:
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as e:
        logger.error(f"Webhook failed: {e}")
        return False


def deliver_alert(
    db: Session,
    organization_id: int,
    rule_name: str,
    message: str,
    severity: str,
    channels: list[str],
    alert_id: Optional[int] = None,
    org_user_ids: Optional[list[int]] = None,
) -> list[str]:
    """Delivers an alert through the requested channels. Returns channels actually sent."""
    config = get_org_config(db, organization_id)
    sent: list[str] = []

    if "email" in channels and config["email_recipients"]:
        recipients = [r.strip() for r in config["email_recipients"].split(",") if r.strip()]
        body = f"<p>{message}</p><p><small>Rule: {rule_name} &middot; Severity: {severity.upper()} &middot; NetPulse</small></p>"
        if send_email(f"[{severity.upper()}] NetPulse Alert: {rule_name}", body, recipients):
            sent.append("email")

    if "slack" in channels and config["slack_webhook_url"]:
        emoji = {"critical": ":red_circle:", "warning": ":warning:", "info": ":information_source:"}.get(severity, ":warning:")
        if send_slack(f"{emoji} *[{severity.upper()}]* {rule_name}: {message}", config["slack_webhook_url"]):
            sent.append("slack")

    if "teams" in channels and config["teams_webhook_url"]:
        if send_teams(f"{rule_name}: {message}", config["teams_webhook_url"]):
            sent.append("teams")

    if "webhook" in channels and config["webhook_url"]:
        if send_webhook(message, config["webhook_url"]):
            sent.append("webhook")

    if "in_app" in channels and org_user_ids:
        for user_id in org_user_ids:
            db.add(
                InAppNotification(
                    organization_id=organization_id,
                    user_id=user_id,
                    alert_id=alert_id,
                    title=f"{severity.upper()} · {rule_name}",
                    message=message,
                    severity=severity,
                )
            )
        sent.append("in_app")

    if sent:
        db.commit()
    return sent


def get_org_user_ids(db: Session, organization_id: int) -> list[int]:
    users = db.query(User).filter(User.organization_id == organization_id, User.is_active.is_(True)).all()
    return [u.id for u in users]
