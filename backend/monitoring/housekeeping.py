"""Housekeeping jobs: retention cleanup, stale device pruning."""
import logging
from datetime import timedelta

from core.security import utcnow
from database.session import SessionLocal
from models import CheckResult, Device, Organization
from tenants.service import get_org_plan

logger = logging.getLogger(__name__)


def cleanup_old_results() -> None:
    """Deletes check results older than the plan's retention window."""
    db = SessionLocal()
    try:
        orgs = db.query(Organization).all()
        for org in orgs:
            try:
                plan = get_org_plan(db, org)
                cutoff = utcnow() - timedelta(days=plan.max_retention_days)
                deleted = (
                    db.query(CheckResult)
                    .filter(CheckResult.organization_id == org.id, CheckResult.timestamp < cutoff)
                    .delete(synchronize_session=False)
                )
                if deleted:
                    db.commit()
                    logger.info(f"Retention cleanup: removed {deleted} results for org {org.id}")
            except Exception as e:
                logger.warning(f"Retention cleanup failed for org {org.id}: {e}")
                db.rollback()
    finally:
        db.close()


def prune_stale_devices() -> None:
    """Marks devices as offline when no check result arrived within their expected interval."""
    db = SessionLocal()
    try:
        from monitoring.engine import _effective_interval
        from tenants.service import default_plan

        plan = default_plan(db)
        devices = db.query(Device).filter(Device.monitoring_enabled.is_(True)).all()
        now = utcnow()
        changed = 0
        for device in devices:
            interval = _effective_interval(device, plan.monitoring_interval)
            stale_after = timedelta(seconds=interval * 3)
            if device.updated_at and (now - device.updated_at) > stale_after and device.status == "Online":
                device.status = "Offline"
                device.updated_at = now
                changed += 1
        if changed:
            db.commit()
    finally:
        db.close()
