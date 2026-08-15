"""Predictive analytics. Predictions are only produced with sufficient history (>= 14 days)."""
import statistics
from datetime import timedelta
from typing import Optional

from sqlalchemy.orm import Session

from core.security import utcnow
from models import CheckResult, Device

MIN_DAYS_REQUIRED = 14


def _linear_trend(values: list[tuple[int, float]]) -> Optional[tuple[float, float]]:
    """Least-squares fit of (x, y) -> (slope, intercept)."""
    if len(values) < 3:
        return None
    n = len(values)
    xs = [v[0] for v in values]
    ys = [v[1] for v in values]
    x_mean = sum(xs) / n
    y_mean = sum(ys) / n
    num = sum((x - x_mean) * (y - y_mean) for x, y in values)
    den = sum((x - x_mean) ** 2 for x in xs)
    if den == 0:
        return None
    slope = num / den
    intercept = y_mean - slope * x_mean
    return slope, intercept


def predict_device(db: Session, organization_id: int, device: Device) -> Optional[dict]:
    """Predicts latency trend + instability risk for a device. None if insufficient data."""
    now = utcnow()
    results = (
        db.query(CheckResult)
        .filter(CheckResult.device_id == device.id, CheckResult.organization_id == organization_id,
                CheckResult.timestamp >= now - timedelta(days=45))
        .all()
    )
    if not results:
        return None
    first_ts = min(r.timestamp for r in results)
    days_of_history = (now - first_ts).days
    if days_of_history < MIN_DAYS_REQUIRED:
        return None

    # Daily mean latency
    daily: dict[str, list[float]] = {}
    failures_by_day: dict[str, int] = {}
    for r in results:
        key = r.timestamp.strftime("%Y-%m-%d")
        daily.setdefault(key, [])
        failures_by_day.setdefault(key, 0)
        if r.latency is not None:
            daily[key].append(r.latency)
        if r.status == "Offline":
            failures_by_day[key] += 1

    points = []
    day_index = 0
    for key in sorted(daily):
        values = daily[key]
        if values:
            points.append((day_index, statistics.mean(values)))
        day_index += 1

    trend = _linear_trend(points)
    prediction = None
    risk = 0.0
    risk_level = "Low"
    if trend:
        slope, intercept = trend
        forecast_day = day_index + 7
        predicted_latency = max(0, slope * forecast_day + intercept)
        prediction = {"latency_ms": round(predicted_latency, 1), "days_ahead": 7}
        # Risk: upward latency trend + failure frequency
        failure_rate = sum(failures_by_day.values()) / max(sum(1 for v in daily.values() if v), 1)
        risk = min(1.0, max(0.0, slope * 2) + failure_rate * 3)
        risk_level = "High" if risk >= 0.6 else "Medium" if risk >= 0.3 else "Low"

    return {
        "device_id": device.id,
        "device_name": device.name,
        "ip_address": device.ip_address,
        "days_of_history": days_of_history,
        "latency_trend": prediction,
        "instability_risk": round(risk, 2),
        "risk_level": risk_level,
        "confidence": min(95, 60 + days_of_history) if prediction else None,
    }


def run_org_predictions(db: Session, organization_id: int) -> list[dict]:
    devices = db.query(Device).filter(Device.organization_id == organization_id).all()
    predictions = []
    for device in devices:
        pred = predict_device(db, organization_id, device)
        if pred and pred.get("instability_risk", 0) >= 0.3:
            predictions.append(pred)
    predictions.sort(key=lambda p: p.get("instability_risk", 0), reverse=True)
    return predictions


def predictions_available(org_predictions: list[dict]) -> bool:
    return bool(org_predictions)
