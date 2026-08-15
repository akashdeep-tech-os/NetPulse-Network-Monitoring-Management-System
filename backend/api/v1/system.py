"""System endpoints: health checks for load balancers / uptime probes."""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.dependencies import get_db
from core.security import utcnow

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "degraded"
    return {"status": "ok", "database": db_status, "timestamp": utcnow().isoformat()}
