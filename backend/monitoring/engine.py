"""Monitoring engine: runs checks against devices, stores results, updates statuses."""
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from typing import Optional

from sqlalchemy.orm import Session

from core.config import settings
from core.security import utcnow
from database.session import SessionLocal
from models import CheckResult, Device, DeviceCheck
from monitoring.checks import run_check

logger = logging.getLogger(__name__)


def _effective_interval(device: Device, plan_interval: int) -> int:
    return device.monitoring_interval or plan_interval


def _device_host(device: Device, check: DeviceCheck) -> str:
    return check.host or device.hostname or device.ip_address


def execute_check(db: Session, check: DeviceCheck, plan_interval: int) -> Optional[CheckResult]:
    """Runs a single check and persists the result. Called from worker threads."""
    device = db.query(Device).filter(Device.id == check.device_id).first()
    if device is None:
        return None
    host = _device_host(device, check)

    outcome = run_check(
        check.check_type,
        host,
        port=check.port,
        url=check.url,
        expected_status_code=check.expected_status_code,
        timeout_seconds=check.timeout_seconds,
    )

    result = CheckResult(
        organization_id=check.organization_id,
        device_id=device.id,
        check_id=check.id,
        check_type=check.check_type,
        timestamp=utcnow(),
        status=outcome.status,
        latency=outcome.latency,
        packet_loss=outcome.packet_loss,
        response_code=outcome.response_code,
        error_message=outcome.error_message,
        details=outcome.details,
    )
    db.add(result)

    check.status = outcome.status
    check.latency = outcome.latency
    check.error = outcome.error_message
    check.last_checked_at = result.timestamp
    check.consecutive_failures = check.consecutive_failures + 1 if outcome.status == "Offline" else 0

    status_changed = False
    if device.status != outcome.status:
        status_changed = True
        device.status = outcome.status
    if outcome.latency is not None:
        device_latency = _aggregate_device_latency(db, device.id, outcome.latency)
        device.latency = device_latency
    device.updated_at = result.timestamp

    db.commit()
    return result


def _aggregate_device_latency(db: Session, device_id: int, current: float) -> float:
    """Blends recent historical latency with the current sample for a stable reading."""
    recent = (
        db.query(CheckResult)
        .filter(CheckResult.device_id == device_id, CheckResult.latency.isnot(None))
        .order_by(CheckResult.timestamp.desc())
        .limit(10)
        .all()
    )
    values = [r.latency for r in recent if r.latency is not None]
    if not values:
        return round(current, 2)
    return round(sum(values) / len(values), 2)


def run_all_due() -> None:
    """Background job: finds enabled checks due for execution and runs them concurrently."""
    db = SessionLocal()
    try:
        from tenants.service import default_plan

        plan = default_plan(db)
        plan_interval = plan.monitoring_interval
        now = utcnow()

        due = (
            db.query(DeviceCheck)
            .filter(DeviceCheck.enabled.is_(True))
            .all()
        )
        due = [
            c
            for c in due
            if c.last_checked_at is None or (now - c.last_checked_at).total_seconds() >= _effective_interval(c.device, plan_interval)
        ]
        if not due:
            return

        ids = [c.id for c in due]
        db.close()

        def _worker(check_id: int) -> Optional[CheckResult]:
            worker_db = SessionLocal()
            try:
                check = worker_db.query(DeviceCheck).filter(DeviceCheck.id == check_id).first()
                if check is None:
                    return None
                return execute_check(worker_db, check, plan_interval)
            except Exception as e:
                logger.exception(f"Check {check_id} failed: {e}")
                return None
            finally:
                worker_db.close()

        with ThreadPoolExecutor(max_workers=settings.MONITORING_WORKERS) as pool:
            list(pool.map(_worker, ids))
        logger.info(f"Monitoring batch: {len(ids)} checks executed")
    finally:
        db.close()
