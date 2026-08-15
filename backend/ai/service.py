"""AI orchestration: summaries, root cause, NL assistant. All data comes from controlled tools."""
import logging
from typing import Optional

from sqlalchemy.orm import Session

from ai.analyzer import (
    TOOL_REGISTRY,
    compare_periods,
    get_alert_summary,
    get_charts,
    get_device_metrics,
    get_downtime_report,
    get_group_metrics,
    get_network_health,
    get_offline_devices,
    get_top_problem_devices,
)
from ai.anomaly_detector import run_org_anomaly_detection
from ai.predictor import run_org_predictions
from ai.provider import get_provider, is_llm_available
from ai.prompts import chat_prompt, root_cause_prompt, summary_prompt
from ai.recommendations import build_recommendations
from analytics.service import get_health_score, get_kpis
from models import AIInsight, AIChatMessage, Organization

logger = logging.getLogger(__name__)


# ─── Insight persistence ───────────────────────────────────────
def persist_insight(db: Session, organization_id: int, insight_type: str, title: str,
                    content: str, severity: str = "info", confidence: Optional[int] = None,
                    evidence: Optional[list] = None) -> AIInsight:
    insight = AIInsight(
        organization_id=organization_id,
        insight_type=insight_type,
        title=title,
        content=content,
        severity=severity,
        confidence=confidence,
        evidence=evidence,
    )
    db.add(insight)
    db.commit()
    db.refresh(insight)
    return insight


# ─── Network summary (from real metrics) ───────────────────────
def generate_network_summary(db: Session, organization_id: int) -> dict:
    health = get_health_score(db, organization_id)
    kpis = get_kpis(db, organization_id)
    problem_devices = get_top_problem_devices(db, organization_id, hours=24, limit=3)
    alerts = get_alert_summary(db, organization_id, hours=24)

    has_data = kpis["total_devices"] > 0 and kpis["overall_uptime"] is not None
    metrics = {"health": health, "kpis": kpis, "top_problem_devices": problem_devices, "alerts": alerts}
    evidence = [
        {"metric": "health_score", "value": health["score"]},
        {"metric": "uptime", "value": kpis["overall_uptime"]},
        {"metric": "active_alerts", "value": kpis["active_alerts"]},
    ]

    if not has_data:
        content = "Insufficient monitoring data available for a reliable analysis. Add devices and enable monitoring checks to enable AI-powered insights."
        return {"summary": content, "confidence": None, "evidence": []}

    # Rule-based summary (always available)
    parts = [f"Your network health is {health['score']}% ({health['grade'].lower()})."]
    if health["change_vs_last_week"] != 0:
        direction = "improved" if health["change_vs_last_week"] > 0 else "decreased"
        parts.append(f"Network health has {direction} by {abs(health['change_vs_last_week'])} points compared with last week.")

    failed_devices = [d for d in problem_devices if d.get("failure_count", 0) > 0]
    if failed_devices:
        names = ", ".join(d["device_name"] for d in failed_devices[:3])
        parts.append(f"{len(failed_devices)} device(s) experienced repeated connectivity issues in the last 24 hours: {names}.")

    offline = kpis["offline_devices"]
    if offline:
        parts.append(f"{offline} device(s) are currently offline.")

    if kpis["active_alerts"]:
        parts.append(f"There are {kpis['active_alerts']} active alert(s), {kpis['critical_alerts']} critical.")

    content = " ".join(parts)

    # Optionally refine via LLM (fallback to rule-based on failure)
    if is_llm_available():
        try:
            system, user = summary_prompt(metrics)
            llm = get_provider().generate(system, user, max_tokens=250)
            if llm:
                content = llm.strip()
        except Exception as e:
            logger.warning(f"LLM summary failed, using rule-based: {e}")

    return {"summary": content, "confidence": 85, "evidence": evidence}


# ─── Root cause analysis ───────────────────────────────────────
def explain_root_cause(db: Session, organization_id: int) -> dict:
    health = get_health_score(db, organization_id)
    anomalies = run_org_anomaly_detection(db, organization_id)
    metrics = get_device_metrics(db, organization_id)

    if not metrics:
        return {
            "summary": "Insufficient monitoring data available for a reliable analysis.",
            "confidence": None,
            "evidence": [],
        }

    # Determine the most probable culprit: highest-severity anomaly
    culprit = None
    if anomalies:
        culprit = max(anomalies, key=lambda a: {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(a.get("severity", "low"), 4))

    if culprit is None:
        if health["score"] >= 90:
            return {
                "summary": "No significant problems detected. Your network metrics are within expected ranges.",
                "confidence": 90,
                "evidence": [{"metric": "health_score", "value": health["score"]}],
            }
        return {
            "summary": "No specific anomaly detected, but health is below target. Consider checking devices with elevated latency or downtime.",
            "confidence": 60,
            "evidence": [{"metric": "health_score", "value": health["score"]}],
        }

    related = [a for a in anomalies if a.get("device_id") == culprit.get("device_id") and a is not culprit]
    downstream = [m for m in metrics if m["group_id"] == culprit.get("device_id")]  # same-group correlation
    evidence = [
        {"type": a["type"], "message": a["message"], "severity": a.get("severity")}
        for a in [culprit] + related[:3]
    ]
    summary = (
        f"The primary issue appears to be {culprit['message']}. "
        f"This is a probable root cause — {culprit.get('severity', 'medium')} severity. "
    )
    if related:
        summary += f"Related signs on the same device: {', '.join(r['message'] for r in related[:2])}. "
    if downstream:
        summary += f"{len(downstream)} other device(s) may be affected in the same group. "
    summary += "Confidence is based on statistical deviation from recent baselines."
    confidence = 87 if culprit.get("severity") in ("critical", "high") else 70

    return {"summary": summary, "confidence": confidence, "evidence": evidence}


# ─── NL assistant ──────────────────────────────────────────────
def _classify_intent(question: str) -> tuple[Optional[str], dict]:
    q = question.lower()
    if any(w in q for w in ["offline", "down right now", "not responding", "unreachable", "not reachable"]):
        return ("get_offline_devices", {})
    if any(w in q for w in ["downtime", "outage", "was it down", "down time"]):
        return ("get_downtime_report", {})
    if any(w in q for w in ["compare", "vs last", "vs previous", "compared to last", "last week vs"]):
        return ("compare_periods", {})
    if any(w in q for w in ["problem", "investigate", "worst", "trouble", "unhealthy"]):
        return ("get_top_problem_devices", {})
    if any(w in q for w in ["group", "groups"]):
        return ("get_group_metrics", {})
    if any(w in q for w in ["alert", "notifications"]):
        return ("get_alert_summary", {})
    if any(w in q for w in ["packet loss", "loss"]):
        return ("get_device_metrics", {})
    if any(w in q for w in ["latency", "slow", "response time", "ping"]):
        return ("get_device_metrics", {})
    if any(w in q for w in ["uptime", "availability", "up %", "percent up"]):
        return ("get_device_metrics", {})
    if any(w in q for w in ["health", "how is", "status", "summary", "overview", "weekly", "report"]):
        return ("get_network_health", {})
    if any(w in q for w in ["chart", "graph", "trend", "performance"]):
        return ("get_charts", {})
    return None, {}


def _answer_from_tool(question: str, tool_name: str, data) -> dict:
    """Deterministic answers from tool data. Always factual."""
    if tool_name == "get_offline_devices":
        if not data:
            return {"reply": "No devices are currently offline.", "confidence": 90}
        names = ", ".join(d["name"] for d in data[:10])
        extra = f" and {len(data) - 10} more" if len(data) > 10 else ""
        return {"reply": f"{len(data)} device(s) are currently offline: {names}{extra}.", "confidence": 90}
    if tool_name == "get_downtime_report":
        dt = data
        return {
            "reply": f"In the selected period: {dt['outage_count']} outage(s), total downtime {dt['total_downtime_seconds'] // 60} minutes, "
                     f"longest outage {dt['longest_outage_seconds'] // 60} minutes, mean time to recovery {dt['mttr_seconds'] // 60} minutes.",
            "confidence": 85,
        }
    if tool_name == "get_top_problem_devices":
        if not data:
            return {"reply": "No problem devices detected in the current period.", "confidence": 90}
        lines = [f"{d['device_name']} ({d['severity']}, score {d['problem_score']})" for d in data]
        return {"reply": "Top problem devices:\n" + "\n".join(f"• {l}" for l in lines), "confidence": 80}
    if tool_name == "get_group_metrics":
        if not data:
            return {"reply": "No groups configured yet.", "confidence": 90}
        worst = min(data, key=lambda g: g["uptime_pct"] if g["uptime_pct"] is not None else 100)
        best = max(data, key=lambda g: g["uptime_pct"] if g["uptime_pct"] is not None else 0)
        reply = f"{len(data)} group(s) analyzed. Best uptime: {best['group']} ({best['uptime_pct']}%)."
        if worst["uptime_pct"] is not None:
            reply += f" Worst: {worst['group']} ({worst['uptime_pct']}%)."
        return {"reply": reply, "confidence": 85}
    if tool_name == "get_alert_summary":
        return {
            "reply": f"{data['total_alerts']} alert(s) in the last {data['period_hours']}h: "
                     f"{data['by_severity'].get('critical', 0)} critical, "
                     f"{data['by_severity'].get('warning', 0)} warning, "
                     f"{data['by_severity'].get('info', 0)} info.",
            "confidence": 90,
        }
    if tool_name == "compare_periods":
        up = data.get("uptime_change_pct")
        lat = data.get("latency_change_pct")
        alerts = data.get("alert_change_pct")
        up_str = f"{up:+.1f}%" if up is not None else "n/a"
        lat_str = f"{lat:+.1f}%" if lat is not None else "n/a"
        alert_str = f"{alerts:+.1f}%" if alerts is not None else "n/a"
        return {
            "reply": f"Compared with the previous period: uptime {up_str}, latency change {lat_str}, alert change {alert_str}.",
            "confidence": 80,
        }
    if tool_name == "get_device_metrics":
        offline = [m for m in data if m["status"] == "Offline"]
        lossy = [m for m in data if m["avg_packet_loss_pct"] is not None and m["avg_packet_loss_pct"] > 5]
        slow = sorted([m for m in data if m["avg_latency_ms"] is not None], key=lambda m: m["avg_latency_ms"], reverse=True)
        parts = []
        if offline:
            names = ", ".join(m["name"] for m in offline[:5])
            parts.append(f"{len(offline)} offline: {names}")
        if lossy:
            loss_parts = []
            for m in lossy[:5]:
                loss_parts.append(f"{m['name']} ({m['avg_packet_loss_pct']}%)")
            parts.append("packet loss >5%: " + ", ".join(loss_parts))
        if slow:
            slow_parts = []
            for m in slow[:3]:
                slow_parts.append(f"{m['name']} ({m['avg_latency_ms']}ms)")
            parts.append("highest latency: " + ", ".join(slow_parts))
        if not parts:
            return {"reply": "All monitored devices look healthy in the selected period.", "confidence": 85}
        return {"reply": " ".join(parts), "confidence": 80}
    if tool_name == "get_network_health":
        h = data.get("health_score", {})
        k = data.get("kpis", {})
        return {
            "reply": f"Network health is {h.get('score')}% ({h.get('grade')}). "
                     f"{k.get('online_devices')} of {k.get('total_devices')} devices online, "
                     f"uptime {k.get('overall_uptime')}%, {k.get('active_alerts')} active alert(s).",
            "confidence": 85,
        }
    if tool_name == "get_charts":
        return {"reply": "Chart data retrieved. Use the Analytics page for interactive visualizations.", "confidence": 80}
    return {"reply": "I could not answer that question with the available analytics tools.", "confidence": None}


def answer_question(db: Session, organization_id: int, question: str, user_id: int,
                    persist_history: bool = True) -> dict:
    """AI Network Assistant: intent → controlled tool → factual answer (optionally LLM-refined)."""
    tool_name, _ = _classify_intent(question)
    if tool_name is None:
        reply = ("I can help with questions like: which devices are offline, why is network health low, "
                 "which device has the highest latency, devices with packet loss, group uptime, "
                 "week-over-week comparison, alert summaries, and top problem devices.")
        return {"reply": reply, "tool_name": None, "evidence": None, "confidence": None}

    tool = TOOL_REGISTRY[tool_name]
    try:
        data = tool(db, organization_id)
    except Exception as e:
        logger.exception("Tool execution failed")
        return {"reply": f"An error occurred while analyzing your network data ({str(e)[:100]}).", "tool_name": tool_name,
                "evidence": None, "confidence": None}

    answer = _answer_from_tool(question, tool_name, data)

    if is_llm_available() and tool_name in ("get_network_health", "get_device_metrics", "compare_periods"):
        try:
            system, user = chat_prompt(question, data, tool_name)
            llm = get_provider().generate(system, user, max_tokens=400)
            if llm:
                answer["reply"] = llm.strip()
                answer["llm_refined"] = True
        except Exception as e:
            logger.warning(f"LLM chat refinement failed: {e}")

    answer["tool_name"] = tool_name
    answer["evidence"] = data if isinstance(data, list) else list(data.items())[:6] if isinstance(data, dict) else None

    if persist_history:
        db.add(AIChatMessage(organization_id=organization_id, user_id=user_id, role="user", content=question))
        db.add(AIChatMessage(organization_id=organization_id, user_id=user_id, role="assistant",
                             content=answer["reply"], tool_name=tool_name))
        db.commit()
    return answer


def list_chat_history(db: Session, organization_id: int, user_id: int, limit: int = 50) -> list[AIChatMessage]:
    return (
        db.query(AIChatMessage)
        .filter(AIChatMessage.organization_id == organization_id, AIChatMessage.user_id == user_id)
        .order_by(AIChatMessage.created_at.desc())
        .limit(limit)
        .all()
    )


def build_dashboard_ai(db: Session, organization_id: int) -> dict:
    """Assembles everything the AI dashboard panel needs."""
    summary = generate_network_summary(db, organization_id)
    insights = run_org_anomaly_detection(db, organization_id)
    recommendations = build_recommendations(db, organization_id)
    predictions = run_org_predictions(db, organization_id)
    return {
        "summary": summary,
        "anomalies": insights,
        "recommendations": recommendations,
        "predictions": predictions,
    }
