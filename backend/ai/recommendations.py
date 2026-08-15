"""Evidence-based recommendations. Every recommendation references real metrics."""
from datetime import timedelta
from typing import Optional

from sqlalchemy.orm import Session

from analytics.service import get_top_problem_devices
from core.security import utcnow
from models import CheckResult, Device, DeviceCheck
from monitoring.checks import ssl_expiry_days


def build_recommendations(db: Session, organization_id: int, limit: int = 8) -> list[dict]:
    """Generates recommendations from actual monitoring evidence."""
    recommendations: list[dict] = []
    now = utcnow()

    devices = db.query(Device).filter(Device.organization_id == organization_id).all()
    results = (
        db.query(CheckResult)
        .filter(CheckResult.organization_id == organization_id, CheckResult.timestamp >= now - timedelta(hours=48))
        .all()
    )
    by_device: dict[int, list[CheckResult]] = {}
    for r in results:
        by_device.setdefault(r.device_id, []).append(r)

    # High latency above baseline
    for d in devices:
        rows = by_device.get(d.id, [])
        latencies = [r.latency for r in rows if r.latency is not None]
        if len(latencies) >= 10:
            mean = sum(latencies) / len(latencies)
            if mean >= 100:
                recommendations.append({
                    "priority": "high",
                    "category": "latency",
                    "title": f"Investigate {d.name}",
                    "content": f"Average latency is {round(mean, 0):.0f}ms over the last 48h (IP {d.ip_address}). This may indicate congestion or an upstream issue.",
                    "evidence": {"device": d.name, "avg_latency_ms": round(mean, 1), "samples": len(latencies)},
                })

    # Packet loss
    for d in devices:
        rows = by_device.get(d.id, [])
        losses = [r.packet_loss for r in rows if r.packet_loss is not None]
        if losses and max(losses) >= 5:
            recommendations.append({
                "priority": "high" if max(losses) >= 15 else "medium",
                "category": "packet_loss",
                "title": f"Packet loss on {d.name}",
                "content": f"Packet loss reached {max(losses):.0f}% in the last 48h. Check cabling, link quality or switch port.",
                "evidence": {"device": d.name, "max_packet_loss_pct": round(max(losses), 1)},
            })

    # Repeated failures
    for d in devices:
        check = db.query(DeviceCheck).filter(DeviceCheck.device_id == d.id).order_by(DeviceCheck.id.desc()).first()
        if check and check.consecutive_failures >= 3:
            recommendations.append({
                "priority": "critical" if check.consecutive_failures >= 6 else "high",
                "category": "failure",
                "title": f"{d.name} has failed {check.consecutive_failures} consecutive checks",
                "content": f"Repeated {check.check_type} failures detected. Verify the device is powered on and reachable.",
                "evidence": {"device": d.name, "consecutive_failures": check.consecutive_failures, "check_type": check.check_type},
            })

    # SSL expiry
    for d in devices:
        if d.ip_address:
            days = ssl_expiry_days(d.ip_address)
            if days is not None and days <= 30:
                recommendations.append({
                    "priority": "high" if days <= 14 else "medium",
                    "category": "ssl",
                    "title": f"SSL certificate on {d.name} expires in {days} days",
                    "content": f"Certificate on {d.ip_address} expires in {days} day(s). Renew before expiry to avoid HTTPS outages.",
                    "evidence": {"device": d.name, "days_to_expiry": days},
                })

    # Monitoring frequency for critical devices (optimization)
    critical_devices = get_top_problem_devices(db, organization_id, hours=48, limit=3)
    for item in critical_devices:
        if item["severity"] in ("Critical", "High"):
            recommendations.append({
                "priority": "optimization",
                "category": "monitoring",
                "title": f"Increase monitoring frequency for {item['device_name']}",
                "content": "Problem devices benefit from shorter check intervals for faster detection.",
                "evidence": {"device": item["device_name"], "problem_score": item["problem_score"]},
            })
            break

    recommendations.sort(key=lambda r: {"critical": 0, "high": 1, "medium": 2, "optimization": 3}.get(r["priority"], 4))
    return recommendations[:limit]
