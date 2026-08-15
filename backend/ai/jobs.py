"""Background job: periodic anomaly detection + recommendations persisted as insights."""
import logging

from ai.anomaly_detector import run_org_anomaly_detection
from ai.predictor import run_org_predictions
from ai.recommendations import build_recommendations
from ai.service import persist_insight
from database.session import SessionLocal
from models import Organization

logger = logging.getLogger(__name__)


def run_detection_job() -> int:
    """Runs for all organizations. Stores anomalies, predictions and recommendations."""
    db = SessionLocal()
    created = 0
    try:
        org_ids = [o.id for o in db.query(Organization).all()]
        for org_id in org_ids:
            try:
                created += _run_for_org(db, org_id)
                db.commit()
            except Exception as e:
                logger.exception(f"Detection job failed for org {org_id}: {e}")
                db.rollback()
        return created
    finally:
        db.close()


def _run_for_org(db, org_id: int) -> int:
    count = 0
    anomalies = run_org_anomaly_detection(db, org_id)
    for a in anomalies:
        persist_insight(
            db, org_id, "anomaly",
            a.get("message", "Anomaly detected")[:120],
            a.get("message", "Anomaly detected"),
            severity=a.get("severity", "medium"),
            confidence=75,
            evidence=[a],
        )
        count += 1

    predictions = run_org_predictions(db, org_id)
    if predictions:
        top = predictions[0]
        persist_insight(
            db, org_id, "prediction",
            f"Risk: {top['device_name']} ({top['risk_level']})",
            f"{top['device_name']} ({top['ip_address']}) shows {top['risk_level'].lower()} instability risk "
            f"({top.get('instability_risk', 0) * 100:.0f}%) based on {top['days_of_history']} days of history. "
            f"Predicted latency in 7 days: {top['latency_trend']['latency_ms']}ms."
            if top.get("latency_trend") else f"{top['device_name']} shows elevated instability risk.",
            severity="high" if top["risk_level"] == "High" else "medium",
            confidence=top.get("confidence"),
            evidence=predictions[:3],
        )
        count += 1
    else:
        from ai.predictor import MIN_DAYS_REQUIRED

        persist_insight(
            db, org_id, "prediction",
            "Prediction unavailable",
            f"At least {MIN_DAYS_REQUIRED} days of monitoring history is recommended before predictions can be made.",
            severity="info",
        )
        count += 1

    recommendations = build_recommendations(db, org_id)
    for r in recommendations:
        persist_insight(
            db, org_id, "recommendation",
            r["title"],
            r["content"],
            severity=r["priority"],
            confidence=80,
            evidence=[r.get("evidence", {})],
        )
        count += 1
    return count
