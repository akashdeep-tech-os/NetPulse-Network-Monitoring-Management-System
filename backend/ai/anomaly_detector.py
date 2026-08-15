"""Statistical anomaly detection. The LLM explains anomalies — it never computes them."""
import statistics
from datetime import timedelta
from typing import Optional

from sqlalchemy.orm import Session

from core.security import utcnow
from models import AlertLog, CheckResult, Device, DeviceCheck


def _baseline(values: list[float]) -> tuple[Optional[float], Optional[float]]:
    """Returns (mean, std) of a baseline series."""
    if len(values) < 3:
        return None, None
    mean = statistics.mean(values)
    std = statistics.pstdev(values) if len(values) > 1 else 0.0
    return mean, max(std, 0.01)


def z_score(value: float, mean: float, std: float) -> float:
    return (value - mean) / std if std else 0.0


def detect_device_anomalies(db: Session, organization_id: int, device: Device, hours: int = 48) -> list[dict]:
    """Detects anomalies for one device. Returns a list of evidence dicts."""
    anomalies: list[dict] = []
    now = utcnow()

    results = (
        db.query(CheckResult)
        .filter(CheckResult.device_id == device.id, CheckResult.organization_id == organization_id,
                CheckResult.timestamp >= now - timedelta(hours=hours))
        .order_by(CheckResult.timestamp.asc())
        .all()
    )
    if not results:
        return anomalies

    # ── Latency anomaly (z-score vs. rolling baseline) ──
    latencies = [(r.timestamp, r.latency) for r in results if r.latency is not None]
    if len(latencies) >= 10:
        baseline_values = [v for _, v in latencies[:-3]]
        mean, std = _baseline(baseline_values)
        if mean is not None:
            for ts, value in latencies[-3:]:
                z = z_score(value, mean, std)
                if z >= 2.5 and value > mean * 1.5:
                    anomalies.append({
                        "type": "latency_spike",
                        "device_id": device.id,
                        "device_name": device.name,
                        "message": f"Latency {value}ms is {z:.1f} sigma above baseline {mean:.0f}ms",
                        "severity": "high" if z >= 4 else "medium",
                        "value": value,
                        "baseline": round(mean, 1),
                        "z_score": round(z, 1),
                        "timestamp": ts.isoformat(),
                    })
                    break

    # ── Packet loss spike ──
    losses = [(r.timestamp, r.packet_loss) for r in results if r.packet_loss is not None]
    if losses:
        mean, std = _baseline([v for _, v in losses])
        if mean is not None:
            ts, value = losses[-1]
            z = z_score(value, mean, std)
            if value >= 10 and z >= 2:
                anomalies.append({
                    "type": "packet_loss_spike",
                    "device_id": device.id,
                    "device_name": device.name,
                    "message": f"Packet loss {value}% vs baseline {mean:.1f}%",
                    "severity": "high",
                    "value": value,
                    "baseline": round(mean, 1),
                    "z_score": round(z, 1),
                    "timestamp": ts.isoformat(),
                })

    # ── Repeated failures ──
    check = db.query(DeviceCheck).filter(DeviceCheck.device_id == device.id).order_by(DeviceCheck.id.desc()).first()
    if check and check.consecutive_failures >= 3:
        anomalies.append({
            "type": "repeated_failure",
            "device_id": device.id,
            "device_name": device.name,
            "message": f"{check.consecutive_failures} consecutive failed checks ({check.check_type})",
            "severity": "critical" if check.consecutive_failures >= 6 else "high",
            "value": check.consecutive_failures,
            "timestamp": utcnow().isoformat(),
        })

    # ── Unusual downtime (24h vs. previous 7 days) ──
    day_results = [r for r in results if r.timestamp >= now - timedelta(hours=24)]
    week_results = [r for r in results if r.timestamp < now - timedelta(hours=24)]
    if day_results and week_results:
        day_fail = sum(1 for r in day_results if r.status == "Offline") / len(day_results)
        week_fail = sum(1 for r in week_results if r.status == "Offline") / len(week_results)
        if day_fail > 0.25 and day_fail > week_fail * 2 + 0.1:
            anomalies.append({
                "type": "unusual_downtime",
                "device_id": device.id,
                "device_name": device.name,
                "message": f"Downtime {day_fail:.0%} in last 24h vs {week_fail:.0%} baseline",
                "severity": "high",
                "value": round(day_fail * 100, 1),
                "baseline": round(week_fail * 100, 1),
                "timestamp": utcnow().isoformat(),
            })

    return anomalies


def detect_alert_frequency_anomaly(db: Session, organization_id: int) -> Optional[dict]:
    now = utcnow()
    recent = db.query(AlertLog).filter(AlertLog.organization_id == organization_id,
                                       AlertLog.created_at >= now - timedelta(hours=24)).count()
    previous = db.query(AlertLog).filter(AlertLog.organization_id == organization_id,
                                         AlertLog.created_at.between(now - timedelta(hours=48), now - timedelta(hours=24))).count()
    if previous >= 5 and recent >= previous * 2:
        return {
            "type": "alert_frequency",
            "device_name": "organization",
            "message": f"Alert frequency {recent}/24h vs {previous}/24h in the previous day",
            "severity": "medium",
            "value": recent,
            "baseline": previous,
            "timestamp": now.isoformat(),
        }
    return None


def run_org_anomaly_detection(db: Session, organization_id: int, max_insights: int = 20) -> list[dict]:
    """Runs anomaly detection for every device of an organization."""
    devices = db.query(Device).filter(Device.organization_id == organization_id).all()
    all_anomalies: list[dict] = []
    for device in devices:
        all_anomalies.extend(detect_device_anomalies(db, organization_id, device))
    freq = detect_alert_frequency_anomaly(db, organization_id)
    if freq:
        all_anomalies.append(freq)
    all_anomalies.sort(key=lambda a: {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(a.get("severity"), 4))
    return all_anomalies[:max_insights]
