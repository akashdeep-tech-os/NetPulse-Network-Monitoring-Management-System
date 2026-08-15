"""Controlled analytics tools. The AI assistant can only use these functions —
it can never execute arbitrary SQL."""
import statistics
from datetime import timedelta
from typing import Optional

from sqlalchemy.orm import Session

from analytics.service import (
    get_chart_data,
    get_health_score,
    get_kpis,
    get_top_problem_devices,
)
from core.security import utcnow
from models import AlertLog, CheckResult, Device, DeviceGroup


def get_network_health(db: Session, organization_id: int) -> dict:
    kpis = get_kpis(db, organization_id)
    health = get_health_score(db, organization_id)
    return {"kpis": kpis, "health_score": health}


def get_device_metrics(db: Session, organization_id: int, hours: int = 24) -> list[dict]:
    devices = db.query(Device).filter(Device.organization_id == organization_id).all()
    results = (
        db.query(CheckResult)
        .filter(CheckResult.organization_id == organization_id, CheckResult.timestamp >= utcnow() - timedelta(hours=hours))
        .all()
    )
    by_device: dict[int, list[CheckResult]] = {}
    for r in results:
        by_device.setdefault(r.device_id, []).append(r)

    out = []
    for d in devices:
        rows = by_device.get(d.id, [])
        latencies = [r.latency for r in rows if r.latency is not None]
        losses = [r.packet_loss for r in rows if r.packet_loss is not None]
        failures = sum(1 for r in rows if r.status == "Offline")
        out.append({
            "device_id": d.id,
            "name": d.name,
            "ip_address": d.ip_address,
            "device_type": d.device_type,
            "group_id": d.group_id,
            "status": d.status,
            "current_latency_ms": d.latency,
            "avg_latency_ms": round(statistics.mean(latencies), 2) if latencies else None,
            "avg_packet_loss_pct": round(statistics.mean(losses), 2) if losses else None,
            "uptime_pct": round((len(rows) - failures) / len(rows) * 100, 1) if rows else None,
            "failure_count": failures,
            "check_count": len(rows),
        })
    return out


def get_device_history(db: Session, organization_id: int, device_id: int, hours: int = 24) -> dict:
    device = (
        db.query(Device)
        .filter(Device.id == device_id, Device.organization_id == organization_id)
        .first()
    )
    if device is None:
        return {"error": "Device not found"}
    results = (
        db.query(CheckResult)
        .filter(CheckResult.device_id == device_id, CheckResult.organization_id == organization_id,
                CheckResult.timestamp >= utcnow() - timedelta(hours=hours))
        .order_by(CheckResult.timestamp.asc())
        .all()
    )
    latencies = [r.latency for r in results if r.latency is not None]
    failures = sum(1 for r in results if r.status == "Offline")
    return {
        "device": device.name,
        "ip_address": device.ip_address,
        "current_status": device.status,
        "period_hours": hours,
        "check_count": len(results),
        "failure_count": failures,
        "uptime_pct": round((len(results) - failures) / len(results) * 100, 1) if results else None,
        "avg_latency_ms": round(statistics.mean(latencies), 2) if latencies else None,
        "max_latency_ms": round(max(latencies), 2) if latencies else None,
        "latency_samples": latencies[-50:],
    }


def get_alert_summary(db: Session, organization_id: int, hours: int = 24) -> dict:
    logs = (
        db.query(AlertLog)
        .filter(AlertLog.organization_id == organization_id, AlertLog.created_at >= utcnow() - timedelta(hours=hours))
        .all()
    )
    by_severity: dict[str, int] = {}
    by_rule: dict[str, int] = {}
    for l in logs:
        by_severity[l.severity] = by_severity.get(l.severity, 0) + 1
        by_rule[l.rule_name or "unknown"] = by_rule.get(l.rule_name or "unknown", 0) + 1
    return {
        "period_hours": hours,
        "total_alerts": len(logs),
        "by_severity": by_severity,
        "by_rule": by_rule,
        "open_alerts": sum(1 for l in logs if l.status == "open"),
    }


def get_downtime_report(db: Session, organization_id: int, hours: int = 24) -> dict:
    from analytics.service import _downtime_stats

    return _downtime_stats(db, organization_id, hours)


def get_group_metrics(db: Session, organization_id: int, hours: int = 24) -> list[dict]:
    groups = db.query(DeviceGroup).filter(DeviceGroup.organization_id == organization_id).all()
    devices = db.query(Device).filter(Device.organization_id == organization_id).all()
    results = (
        db.query(CheckResult)
        .filter(CheckResult.organization_id == organization_id, CheckResult.timestamp >= utcnow() - timedelta(hours=hours))
        .all()
    )
    out = []
    for g in groups:
        group_devices = [d for d in devices if d.group_id == g.id]
        if not group_devices:
            out.append({"group": g.name, "device_count": 0, "uptime_pct": None, "avg_latency_ms": None, "offline_count": 0})
            continue
        ids = {d.id for d in group_devices}
        rows = [r for r in results if r.device_id in ids]
        online = sum(1 for r in rows if r.status == "Online")
        latencies = [r.latency for r in rows if r.latency is not None]
        offline_count = sum(1 for d in group_devices if d.status == "Offline")
        out.append({
            "group": g.name,
            "device_count": len(group_devices),
            "uptime_pct": round(online / len(rows) * 100, 1) if rows else None,
            "avg_latency_ms": round(statistics.mean(latencies), 2) if latencies else None,
            "offline_count": offline_count,
        })
    out.sort(key=lambda x: (x["uptime_pct"] is None, x["uptime_pct"] or 0))
    return out


def compare_periods(db: Session, organization_id: int, hours: int = 24) -> dict:
    now = utcnow()
    current_start = now - timedelta(hours=hours)
    prev_start = now - timedelta(hours=hours * 2)
    current = _period_stats(db, organization_id, current_start, now)
    previous = _period_stats(db, organization_id, prev_start, current_start)

    def delta(cur, prev):
        if cur is None or prev == 0 or prev is None:
            return None
        return round((cur - prev) / prev * 100, 1)

    return {
        "current": current,
        "previous": previous,
        "uptime_change_pct": delta(current["uptime_pct"], previous["uptime_pct"]),
        "latency_change_pct": delta(current["avg_latency_ms"], previous["avg_latency_ms"]),
        "alert_change_pct": delta(current["alert_count"], previous["alert_count"]),
    }


def _period_stats(db: Session, organization_id: int, start, end) -> dict:
    results = (
        db.query(CheckResult)
        .filter(CheckResult.organization_id == organization_id, CheckResult.timestamp.between(start, end))
        .all()
    )
    alerts = (
        db.query(AlertLog)
        .filter(AlertLog.organization_id == organization_id, AlertLog.created_at.between(start, end))
        .count()
    )
    latencies = [r.latency for r in results if r.latency is not None]
    online = sum(1 for r in results if r.status == "Online")
    return {
        "uptime_pct": round(online / len(results) * 100, 1) if results else None,
        "avg_latency_ms": round(statistics.mean(latencies), 2) if latencies else None,
        "alert_count": alerts,
    }


def get_offline_devices(db: Session, organization_id: int) -> list[dict]:
    devices = db.query(Device).filter(Device.organization_id == organization_id, Device.status == "Offline").all()
    return [{"device_id": d.id, "name": d.name, "ip_address": d.ip_address} for d in devices]


def get_charts(db: Session, organization_id: int, hours: int = 24) -> dict:
    return get_chart_data(db, organization_id, hours)


# Tool registry used by the NL assistant (intent → function).
TOOL_REGISTRY = {
    "get_network_health": get_network_health,
    "get_device_metrics": get_device_metrics,
    "get_device_history": get_device_history,
    "get_alert_summary": get_alert_summary,
    "get_downtime_report": get_downtime_report,
    "get_group_metrics": get_group_metrics,
    "get_top_problem_devices": lambda db, org: get_top_problem_devices(db, org, hours=24, limit=5),
    "compare_periods": compare_periods,
    "get_offline_devices": get_offline_devices,
    "get_charts": get_charts,
}
