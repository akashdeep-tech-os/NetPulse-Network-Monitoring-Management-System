import smtplib
import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import urllib.request
import json

logger = logging.getLogger(__name__)


def get_email_config():
    return {
        "smtp_host": os.getenv("SMTP_HOST", ""),
        "smtp_port": int(os.getenv("SMTP_PORT", "587")),
        "smtp_user": os.getenv("SMTP_USER", ""),
        "smtp_password": os.getenv("SMTP_PASSWORD", ""),
        "smtp_from": os.getenv("SMTP_FROM", ""),
        "smtp_use_tls": os.getenv("SMTP_USE_TLS", "true").lower() == "true",
        "alert_recipients": os.getenv("ALERT_RECIPIENTS", ""),
    }


def get_slack_config():
    return {
        "webhook_url": os.getenv("SLACK_WEBHOOK_URL", ""),
    }


def send_email(subject: str, body: str, recipients: list[str] = None) -> bool:
    config = get_email_config()
    if not config["smtp_host"] or not config["smtp_user"]:
        logger.warning("Email not configured: SMTP settings missing")
        return False

    if not recipients:
        recipients = [r.strip() for r in config["alert_recipients"].split(",") if r.strip()]
    if not recipients:
        logger.warning("No email recipients configured")
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = config["smtp_from"] or config["smtp_user"]
        msg["To"] = ", ".join(recipients)
        msg["Subject"] = subject

        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <div style="background: #1e293b; color: white; padding: 15px 20px; border-radius: 8px 8px 0 0;">
                <h2 style="margin: 0;">Surakshit City - Alert</h2>
            </div>
            <div style="border: 1px solid #e2e8f0; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
                {body}
            </div>
        </body>
        </html>
        """

        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(config["smtp_host"], config["smtp_port"]) as server:
            if config["smtp_use_tls"]:
                server.starttls()
            server.login(config["smtp_user"], config["smtp_password"])
            server.sendmail(msg["From"], recipients, msg.as_string())

        logger.info(f"Email alert sent to {recipients}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


def send_slack(message: str, webhook_url: str = None) -> bool:
    config = get_slack_config()
    url = webhook_url or config["webhook_url"]
    if not url:
        logger.warning("Slack not configured: webhook URL missing")
        return False

    try:
        payload = json.dumps({
            "text": message,
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": message,
                    },
                }
            ],
        }).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                logger.info("Slack alert sent successfully")
                return True
        return False
    except Exception as e:
        logger.error(f"Failed to send Slack alert: {e}")
        return False


def send_alert_notification(
    rule_name: str,
    message: str,
    severity: str,
    notify_email: bool,
    notify_slack: bool,
    email_recipients: list[str] = None,
    slack_webhook_url: str = None,
) -> dict:
    result = {"email_sent": False, "slack_sent": False}

    severity_emoji = {
        "critical": ":red_circle:",
        "warning": ":warning:",
        "info": ":information_source:",
        "resolved": ":white_check_mark:",
    }
    emoji = severity_emoji.get(severity, ":warning:")

    if notify_email:
        subject = f"[{severity.upper()}] Surakshit City Alert: {rule_name}"
        email_body = f"""
        <p style="font-size: 16px; color: #334155;">{message}</p>
        <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
            Rule: <strong>{rule_name}</strong><br>
            Severity: <strong>{severity.upper()}</strong><br>
            Time: <strong>{__import__('datetime').datetime.now(__import__('datetime').timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}</strong>
        </p>
        """
        result["email_sent"] = send_email(subject, email_body, email_recipients)

    if notify_slack:
        slack_msg = f"{emoji} *[{severity.upper()}]* {message}"
        result["slack_sent"] = send_slack(slack_msg, webhook_url=slack_webhook_url)

    return result


def test_notification(channel: str, email: str = None, slack_webhook_url: str = None) -> dict:
    if channel == "email":
        subject = "[TEST] Surakshit City Alert Notification"
        body = """
        <p style="font-size: 16px; color: #334155;">
            This is a test notification from Surakshit City Ping Monitor.
        </p>
        <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
            If you received this email, your alert notifications are configured correctly.
        </p>
        """
        recipients = [email] if email else None
        sent = send_email(subject, body, recipients)
        return {"success": sent, "message": "Test email sent" if sent else "Failed to send test email"}

    elif channel == "slack":
        sent = send_slack(":white_check_mark: *Test Alert* - Surakshit City notification configured successfully!", webhook_url=slack_webhook_url)
        return {"success": sent, "message": "Test Slack message sent" if sent else "Failed to send test Slack message"}

    return {"success": False, "message": f"Unknown channel: {channel}"}
