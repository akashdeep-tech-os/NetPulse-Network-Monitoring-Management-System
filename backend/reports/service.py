"""Report generation: CSV / XLSX / PDF exports with org-scoped data."""
import io
import logging
from datetime import timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from analytics.service import get_chart_data, get_health_score, get_kpis, get_top_problem_devices
from core.security import utcnow
from models import AlertLog, CheckResult, Device, DeviceGroup

logger = logging.getLogger(__name__)

REPORT_TYPES = {"health", "uptime", "downtime", "latency", "packet_loss", "alerts", "groups", "ai_summary"}


def _device_downtime(results: list[CheckResult]) -> dict:
    rows = sorted(results, key=lambda r: r.timestamp)
    total = 0
    outages = 0
    longest = 0
    mttr_values = []
    offline_start = None
    for r in rows:
        if r.status.lower() == "offline" and offline_start is None:
            offline_start = r.timestamp
        elif r.status.lower() == "online" and offline_start is not None:
            duration = (r.timestamp - offline_start).total_seconds()
            total += duration
            outages += 1
            longest = max(longest, duration)
            mttr_values.append(duration)
            offline_start = None
    if offline_start is not None:
        duration = (utcnow() - offline_start).total_seconds()
        total += duration
        outages += 1
        longest = max(longest, duration)
        mttr_values.append(duration)
    return {
        "total_downtime_seconds": int(total),
        "outage_count": outages,
        "longest_outage_seconds": int(longest),
        "mttr_seconds": int(sum(mttr_values) / len(mttr_values)) if mttr_values else 0,
    }


def _resolve_dates(from_date: Optional[str], to_date: Optional[str]) -> tuple[object, object]:
    try:
        start = utcnow() - timedelta(days=30) if from_date is None else utcnow()
        return start, utcnow()
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid date range.")


def _rows_for_report(db: Session, organization_id: int, report_type: str, start, end) -> list[dict]:
    if report_type in ("health", "ai_summary"):
        kpis = get_kpis(db, organization_id)
        health = get_health_score(db, organization_id)
        problems = get_top_problem_devices(db, organization_id, hours=24, limit=10)
        return [
            {"section": "KPIs", "metric": "Online devices", "value": kpis["online_devices"]},
            {"section": "KPIs", "metric": "Offline devices", "value": kpis["offline_devices"]},
            {"section": "KPIs", "metric": "Total devices", "value": kpis["total_devices"]},
            {"section": "KPIs", "metric": "Overall uptime %", "value": kpis["overall_uptime"]},
            {"section": "KPIs", "metric": "Active alerts", "value": kpis["active_alerts"]},
            {"section": "Health", "metric": "Health score", "value": f"{health['score']} ({health['grade']})"},
            {"section": "Health", "metric": "Change vs last week", "value": health["change_vs_last_week"]},
        ] + [
            {"section": "Problem devices", "metric": p["device_name"], "value": f"{p['severity']} / score {p['problem_score']}"}
            for p in problems
        ]

    if report_type == "groups":
        rows = []
        for group in db.query(DeviceGroup).filter(DeviceGroup.organization_id == organization_id).all():
            devices = db.query(Device).filter(Device.organization_id == organization_id, Device.group_id == group.id).all()
            results = (
                db.query(CheckResult)
                .filter(CheckResult.organization_id == organization_id,
                        CheckResult.device_id.in_([d.id for d in devices]),
                        CheckResult.timestamp >= start, CheckResult.timestamp < end)
                .all()
            )
            ok = sum(1 for r in results if r.status == "online")
            rows.append({
                "group": group.name,
                "devices": len(devices),
                "checks": len(results),
                "success_rate_%": round(ok * 100 / len(results), 2) if results else None,
            })
        return rows

    device_q = db.query(Device).filter(Device.organization_id == organization_id)
    rows = []
    for device in device_q.all():
        results = (
            db.query(CheckResult)
            .filter(CheckResult.organization_id == organization_id,
                    CheckResult.device_id == device.id,
                    CheckResult.timestamp >= start, CheckResult.timestamp < end)
            .all()
        )
        if not results:
            continue
        ok = [r for r in results if r.status == "online"]
        latencies = [r.latency for r in ok if r.latency is not None]
        losses = [r.packet_loss for r in ok if r.packet_loss is not None]
        downtime = _device_downtime(results)

        if report_type == "uptime":
            rows.append({
                "device": device.name,
                "ip": device.ip_address,
                "checks": len(results),
                "online": len(ok),
                "uptime_%": round(len(ok) * 100 / len(results), 2),
            })
        elif report_type == "downtime":
            rows.append({
                "device": device.name,
                "ip": device.ip_address,
                "outages": downtime["outage_count"],
                "total_downtime_seconds": downtime["total_downtime_seconds"],
                "longest_outage_seconds": downtime["longest_outage_seconds"],
                "mttr_seconds": downtime["mttr_seconds"],
            })
        elif report_type == "latency":
            rows.append({
                "device": device.name,
                "ip": device.ip_address,
                "samples": len(latencies),
                "avg_latency_ms": round(sum(latencies) / len(latencies), 2) if latencies else None,
                "max_latency_ms": max(latencies) if latencies else None,
            })
        elif report_type == "packet_loss":
            rows.append({
                "device": device.name,
                "ip": device.ip_address,
                "samples": len(losses),
                "avg_packet_loss_%": round(sum(losses) / len(losses), 2) if losses else None,
                "max_packet_loss_%": max(losses) if losses else None,
            })
    return rows


def _alerts_rows(db: Session, organization_id: int, start, end) -> list[dict]:
    alerts = (
        db.query(AlertLog)
        .filter(AlertLog.organization_id == organization_id,
                AlertLog.timestamp >= start, AlertLog.timestamp < end)
        .order_by(AlertLog.timestamp.desc())
        .limit(1000)
        .all()
    )
    return [
        {"timestamp": a.timestamp.isoformat(), "severity": a.severity, "message": a.message,
         "device": a.device_name or "", "channel": a.channel}
        for a in alerts
    ]


def _render_csv(rows: list[dict]) -> bytes:
    import csv

    buffer = io.StringIO()
    if rows:
        writer = csv.DictWriter(buffer, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    return buffer.getvalue().encode("utf-8-sig")


def _render_xlsx(rows: list[dict]) -> bytes:
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "Report"
    if rows:
        ws.append(list(rows[0].keys()))
        for row in rows:
            ws.append(list(row.values()))
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def _render_pdf(rows: list[dict], report_type: str, org_name: str) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), title=f"NetPulse {report_type} report")
    styles = getSampleStyleSheet()
    elements = [Paragraph(f"NetPulse {report_type.title()} Report — {org_name}", styles["Title"]),
                Spacer(1, 12)]
    if rows:
        headers = list(rows[0].keys())
        data = [[h.replace("_", " ").title() for h in headers]] + [[str(v) for v in r.values()] for r in rows]
        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
        ]))
        elements.append(table)
    else:
        elements.append(Paragraph("No data for the selected period.", styles["BodyText"]))
    doc.build(elements)
    return buffer.getvalue()


def generate_report(db: Session, organization_id: int, report_type: str, fmt: str,
                    start, end, org_name: str = "Organization") -> bytes:
    if report_type not in REPORT_TYPES:
        raise HTTPException(status_code=422, detail=f"Unknown report type. Valid: {sorted(REPORT_TYPES)}")
    if fmt not in ("csv", "xlsx", "pdf"):
        raise HTTPException(status_code=422, detail="Format must be csv, xlsx or pdf")

    rows = _alerts_rows(db, organization_id, start, end) if report_type == "alerts" else \
        _rows_for_report(db, organization_id, report_type, start, end)

    if fmt == "csv":
        return _render_csv(rows)
    if fmt == "xlsx":
        return _render_xlsx(rows)
    return _render_pdf(rows, report_type, org_name)


def report_filename(report_type: str, fmt: str) -> str:
    return f"netpulse_{report_type}_report_{utcnow().strftime('%Y%m%d_%H%M')}.{fmt}"
