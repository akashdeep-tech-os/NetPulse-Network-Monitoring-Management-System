"""Analytics service: KPIs, health score, charts, downtime, top problem devices.

All queries are scoped to one organization. This module doubles as the
data layer for the AI tool registry (no arbitrary SQL ever reaches the AI).
"""
import json
import statistics
from datetime import timedelta
from typing import Optional

from sqlalchemy.orm import Session

from core.security import utcnow
from models import (
    AIInsight,
    AlertLog,
    CheckResult,
    Device,
    DeviceGroup,
    Setting,
)

HEALTH_WEIGHTS_DEFAULT = {"availability": 0.4, "latency": 0.2, "packet_loss": 0.2, "stability": 0.2}


def get_setting(db: Session, key: str, default: str = "") -> str:
    row = db.query(Setting).filter(Setting.organization_id.is_(None), Setting.key == key).first()
    if row is None:
        row = db.query(Setting).filter(Setting.key == key).first()
    return row.value if row else default


def get_org_setting(db: Session, organization_id: int, key: str, default: str = "") -> str:
    row = db.query(Setting).filter(Setting.organization_id == organization_id, Setting.key == key).first()
    return row.value if row else default


def set_org_setting(db: Session, organization_id: int, key: str, value: str) -> None:
    row = db.query(Setting).filter(Setting.organization_id == organization_id, Setting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(Setting(organization_id=organization_id, key=key, value=value))
    db.commit()


def get_org_settings(db: Session, organization_id: int) -> dict:
    rows = db.query(Setting).filter(Setting.organization_id == organization_id).all()
    return {r.key: r.value for r in rows}


# ─── Core metric queries ───────────────────────────────────────
def recent_results(db: Session, organization_id: int, hours: int = 24, device_ids: Optional[list] = None):
    query = db.query(CheckResult).filter(
        CheckResult.organization_id == organization_id,
        CheckResult.timestamp >= utcnow() - timedelta(hours=hours),
    )
    if device_ids:
        query = query.filter(CheckResult.device_id.in_(device_ids))
    return query.all()


def get_kpis(db: Session, organization_id: int, hours: int = 24) -> dict:
    devices = db.query(Device).filter(Device.organization_id == organization_id).all()
    total = len(devices)
    online = sum(1 for d in devices if d.status == "Online")
    offline = sum(1 for d in devices if d.status == "Offline")
    warning = sum(1 for d in devices if d.status == "Warning")

    latencies = [d.latency for d in devices if d.latency is not None]
    avg_latency = round(sum(latencies) / len(latencies), 2) if latencies else None

    results = recent_results(db, organization_id, hours)
    online_checks = sum(1 for r in results if r.status == "Online")
    uptime = round((online_checks / len(results) * 100), 2) if results else 0.0

    loss_values = [r.packet_loss for r in results if r.packet_loss is not None]
    avg_loss = round(sum(loss_values) / len(loss_values), 2) if loss_values else None

    open_logs = (
        db.query(AlertLog)
        .filter(AlertLog.organization_id == organization_id, AlertLog.status.in_(["open", "acknowledged"]))
        .all()
    )
    critical = sum(1 for l in open_logs if l.severity == "critical")

    return {
        "total_devices": total,
        "online_devices": online,
        "offline_devices": offline,
        "warning_devices": warning,
        "avg_latency": avg_latency,
        "packet_loss": avg_loss,
        "overall_uptime": uptime,
        "active_alerts": len(open_logs),
        "critical_alerts": critical,
    }


def _clamp(score: float) -> int:
    return max(0, min(100, int(round(score))))


def get_health_score(db: Session, organization_id: int, hours: int = 24) -> dict:
    """Computes the configurable network health score.

    Health = availability*0.4 + latency*0.2 + packet_loss*0.2 + stability*0.2
    Weights are configurable via the 'health_score_weights' setting.
    """
    try:
        weights = json.loads(get_setting(db, "health_score_weights", "")) or HEALTH_WEIGHTS_DEFAULT
    except (json.JSONDecodeError, TypeError):
        weights = HEALTH_WEIGHTS_DEFAULT

    devices = db.query(Device).filter(Device.organization_id == organization_id).all()
    results = recent_results(db, organization_id, hours)

    # Availability score: proportion of online checks (0-100)
    availability_score = round((sum(1 for r in results if r.status == "Online") / len(results) * 100), 1) if results else 0

    # Latency score: 100 at <=5ms baseline, decreasing to 0 at >=500ms
    latencies = [r.latency for r in results if r.latency is not None]
    if latencies:
        avg = statistics.mean(latencies)
        latency_score = _clamp(100 * max(0, 1 - (avg - 5) / 495))
    else:
        latency_score = 0

    # Packet loss score: 100 - average loss
    losses = [r.packet_loss for r in results if r.packet_loss is not None]
    packet_loss_score = _clamp(100 - statistics.mean(losses)) if losses else 100

    # Stability score: 100 - failure ratio * 2 (transitions penalize)
    if results:
        fail_ratio = sum(1 for r in results if r.status == "Offline") / len(results)
        stability_score = _clamp(100 - fail_ratio * 200)
    else:
        stability_score = 0

    score = (
        availability_score * weights.get("availability", 0.4)
        + latency_score * weights.get("latency", 0.2)
        + packet_loss_score * weights.get("packet_loss", 0.2)
        + stability_score * weights.get("stability", 0.2)
    )
    score = _clamp(score)

    grade = "Excellent" if score >= 90 else "Good" if score >= 75 else "Fair" if score >= 60 else "Poor"

    # Change vs last week (previous 24h window, 7 days ago)
    prev_start = utcnow() - timedelta(hours=hours + 24 * 7)
    prev_end = prev_start + timedelta(hours=hours)
    prev_results = (
        db.query(CheckResult)
        .filter(CheckResult.organization_id == organization_id, CheckResult.timestamp.between(prev_start, prev_end))
        .all()
    )
    prev_score = None
    if prev_results:
        prev_avail = round((sum(1 for r in prev_results if r.status == "Online") / len(prev_results) * 100), 1)
        prev_score = _clamp(prev_avail * weights.get("availability", 0.4) + 60 * weights.get("latency", 0.2)
                            + 90 * weights.get("packet_loss", 0.2) + 85 * weights.get("stability", 0.2))
    change = round(score - prev_score, 1) if prev_score is not None else 0.0

    return {
        "score": score,
        "grade": grade,
        "availability": round(availability_score, 1),
        "latency": latency_score,
        "packet_loss": packet_loss_score,
        "stability": stability_score,
        "change_vs_last_week": change,
    }


# ─── Chart data ────────────────────────────────────────────────
def _bucket_series(results: list[CheckResult], bucket_seconds: int, label_format: str) -> list[dict]:
    if not results:
        return []
    buckets: dict[int, dict] = {}
    for r in results:
        key = int(r.timestamp.timestamp() // bucket_seconds) * bucket_seconds
        bucket = buckets.setdefault(key, {"count": 0, "online": 0, "latency": []})
        bucket["count"] += 1
        if r.status == "Online":
            bucket["online"] += 1
        if r.latency is not None:
            bucket["latency"].append(r.latency)
    out = []
    for key in sorted(buckets):
        b = buckets[key]
        out.append({
            "timestamp": _format_ts(key, label_format),
            "availability": round(b["online"] / b["count"] * 100, 1) if b["count"] else 0,
            "latency": round(statistics.mean(b["latency"]), 2) if b["latency"] else None,
        })
    return out


def _format_ts(epoch: int, fmt: str) -> str:
    from datetime import datetime

    return datetime.utcfromtimestamp(epoch).strftime(fmt)


def get_chart_data(db: Session, organization_id: int, hours: int = 24) -> dict:
    results = recent_results(db, organization_id, hours)
    now = utcnow()

    if hours <= 24:
        series = _bucket_series(results, 60 * 60, "%H:%M")
    elif hours <= 24 * 7:
        series = _bucket_series(results, 4 * 60 * 60, "%m-%d %H:%M")
    else:
        series = _bucket_series(results, 24 * 60 * 60, "%m-%d")

    # Latency percentiles
    latencies = sorted(r.latency for r in results if r.latency is not None)
    latency_summary = {}
    if latencies:
        def pct(p):
            return round(latencies[min(len(latencies) - 1, int(len(latencies) * p))], 2)

        latency_summary = {
            "avg": round(statistics.mean(latencies), 2),
            "min": round(latencies[0], 2),
            "max": round(latencies[-1], 2),
            "p95": pct(0.95),
            "p99": pct(0.99),
        }

    # Packet loss series (per device, aggregated hourly)
    loss_series = []
    loss_by_hour: dict[str, list] = {}
    for r in results:
        if r.packet_loss is not None:
            key = r.timestamp.strftime("%H:%M")
            loss_by_hour.setdefault(key, []).append(r.packet_loss)
    for key in sorted(loss_by_hour):
        loss_series.append({"timestamp": key, "packet_loss": round(statistics.mean(loss_by_hour[key]), 2)})

    # Downtime analysis
    downtime = _downtime_stats(db, organization_id, hours)

    # Device distribution
    devices = db.query(Device).filter(Device.organization_id == organization_id).all()
    by_type: dict[str, int] = {}
    by_status: dict[str, int] = {}
    by_location: dict[str, int] = {}
    for d in devices:
        by_type[d.device_type or "Unknown"] = by_type.get(d.device_type or "Unknown", 0) + 1
        by_status[d.status] = by_status.get(d.status, 0) + 1
        by_location[d.location or "Unassigned"] = by_location.get(d.location or "Unassigned", 0) + 1
    groups = db.query(DeviceGroup).filter(DeviceGroup.organization_id == organization_id).all()
    by_group = {}
    for g in groups:
        by_group[g.name] = db.query(Device).filter(Device.group_id == g.id).count()

    return {
        "availability_series": series,
        "latency_series": series,
        "latency_summary": latency_summary,
        "packet_loss_series": loss_series,
        "downtime": downtime,
        "device_distribution": {"by_type": by_type, "by_status": by_status, "by_location": by_location, "by_group": by_group},
    }


def _downtime_stats(db: Session, organization_id: int, hours: int) -> dict:
    devices = db.query(Device).filter(Device.organization_id == organization_id).all()
    results = recent_results(db, organization_id, hours)
    by_device: dict[int, list[CheckResult]] = {}
    for r in results:
        by_device.setdefault(r.device_id, []).append(r)

    total_downtime = 0
    outages = 0
    longest = 0
    mttr_values = []
    for device in devices:
        rows = sorted(by_device.get(device.id, []), key=lambda r: r.timestamp)
        offline_start = None
        for r in rows:
            if r.status == "Offline" and offline_start is None:
                offline_start = r.timestamp
            elif r.status == "Online" and offline_start is not None:
                duration = (r.timestamp - offline_start).total_seconds()
                total_downtime += duration
                outages += 1
                longest = max(longest, duration)
                mttr_values.append(duration)
                offline_start = None
        if offline_start is not None:
            duration = (utcnow() - offline_start).total_seconds()
            total_downtime += duration
            outages += 1
            longest = max(longest, duration)
            mttr_values.append(duration)

    return {
        "total_downtime_seconds": int(total_downtime),
        "outage_count": outages,
        "longest_outage_seconds": int(longest),
        "mttr_seconds": int(statistics.mean(mttr_values)) if mttr_values else 0,
    }


def get_top_problem_devices(db: Session, organization_id: int, hours: int = 24, limit: int = 5) -> list[dict]:
    """Ranks devices by downtime, packet loss, latency, alert frequency and failures."""
    devices = db.query(Device).filter(Device.organization_id == organization_id).all()
    if not devices:
        return []
    results = recent_results(db, organization_id, hours)
    alert_logs = (
        db.query(AlertLog)
        .filter(AlertLog.organization_id == organization_id, AlertLog.created_at >= utcnow() - timedelta(hours=hours))
        .all()
    )
    alerts_by_device: dict[int, int] = {}
    for l in alert_logs:
        if l.device_id:
            alerts_by_device[l.device_id] = alerts_by_device.get(l.device_id, 0) + 1

    rows: list[dict] = []
    for d in devices:
        device_results = [r for r in results if r.device_id == d.id]
        if not device_results:
            continue
        downtime = sum(1 for r in device_results if r.status == "Offline") / len(device_results)
        losses = [r.packet_loss for r in device_results if r.packet_loss is not None]
        avg_loss = statistics.mean(losses) if losses else 0
        latencies = [r.latency for r in device_results if r.latency is not None]
        avg_latency = statistics.mean(latencies) if latencies else 0
        alerts = alerts_by_device.get(d.id, 0)

        score = (
            downtime * 5
            + min(avg_loss / 10, 1)
            + min(avg_latency / 500, 1)
            + min(alerts / 5, 1)
            + min(sum(1 for r in device_results if r.status == "Offline") / max(len(device_results) / 10, 1), 1) * 0.5
        )
        severity = "Critical" if score >= 2.5 else "High" if score >= 1.2 else "Medium" if score >= 0.4 else "Low"
        rows.append({
            "device_id": d.id,
            "device_name": d.name,
            "ip_address": d.ip_address,
            "status": d.status,
            "downtime_percent": round(downtime * 100, 1),
            "avg_packet_loss": round(avg_loss, 2),
            "avg_latency": round(avg_latency, 2),
            "alert_count": alerts,
            "failure_count": sum(1 for r in device_results if r.status == "Offline"),
            "problem_score": round(score, 2),
            "severity": severity,
        })
    rows.sort(key=lambda x: x["problem_score"], reverse=True)
    return rows[:limit]


def get_ai_insights(db: Session, organization_id: int, limit: int = 10) -> list[AIInsight]:
    return (
        db.query(AIInsight)
        .filter(AIInsight.organization_id == organization_id)
        .order_by(AIInsight.created_at.desc())
        .limit(limit)
        .all()
    )


def downtime_stats(db: Session, organization_id: int, hours: int = 24) -> dict:
    return _downtime_stats(db, organization_id, hours)


def get_dashboard_data(db: Session, organization_id: int, hours: int = 24) -> dict:
    """Composes everything the dashboard needs in one call."""
    kpis = get_kpis(db, organization_id, hours)
    health = get_health_score(db, organization_id, hours)
    charts = get_chart_data(db, organization_id, hours)
    problems = get_top_problem_devices(db, organization_id, hours=hours, limit=5)
    alerts = (
        db.query(AlertLog)
        .filter(AlertLog.organization_id == organization_id, AlertLog.status == "active")
        .count()
    )
    return {
        "kpis": kpis,
        "health_score": health,
        "charts": charts,
        "problem_devices": problems,
        "active_alerts": alerts,
    }
