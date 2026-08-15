"""Monitoring endpoints: checks, check results, port scanner."""
import socket
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.dependencies import AuthContext, get_auth_context, get_db, require_permission
from core.security import utcnow
from devices import service as devices_service
from models import CheckResult, Device, DeviceCheck, Organization
from schemas import CheckCreate, CheckOut, CheckResultOut, Message, PortScanRequest, PortScanResponse
from tenants.service import get_organization

router = APIRouter(prefix="/monitoring", tags=["monitoring"])

checks_perm = require_permission("devices.view")
checks_manage = require_permission("checks.manage")


def _org(db: Session, auth: AuthContext) -> Organization:
    if auth.org_id is None:
        raise HTTPException(status_code=400, detail="No organization context")
    return get_organization(db, auth.org_id)


# ─── Checks ────────────────────────────────────────────────────
@router.get("/checks", response_model=list[CheckOut])
def list_checks(device_id: Optional[int] = None, auth=Depends(checks_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return devices_service.list_checks(db, org.id, device_id=device_id)


@router.post("/checks", response_model=CheckOut)
def create_check(body: CheckCreate, device_id: int, auth=Depends(checks_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    check = devices_service.create_check(db, org.id, device_id, body.model_dump())
    return check


@router.get("/checks/{check_id}", response_model=CheckOut)
def get_check(check_id: int, auth=Depends(checks_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return devices_service.get_check(db, org.id, check_id)


@router.patch("/checks/{check_id}", response_model=CheckOut)
def update_check(check_id: int, body: CheckCreate, auth=Depends(checks_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    check = devices_service.update_check(db, org.id, check_id, body.model_dump(exclude_unset=True))
    return check


@router.delete("/checks/{check_id}", response_model=Message)
def delete_check(check_id: int, auth=Depends(checks_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    devices_service.delete_check(db, org.id, check_id)
    return Message(message="Check deleted")


@router.post("/checks/{check_id}/run-now", response_model=dict)
def run_check_now(check_id: int, auth=Depends(checks_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    devices_service.run_check_now(db, org.id, check_id)
    result = (
        db.query(CheckResult)
        .filter(CheckResult.check_id == check_id, CheckResult.organization_id == org.id)
        .order_by(CheckResult.timestamp.desc())
        .first()
    )
    if result is None:
        return {"status": "unknown"}
    return CheckResultOut.model_validate(result).model_dump()


# ─── Results ───────────────────────────────────────────────────
@router.get("/results", response_model=list[CheckResultOut])
def list_results(device_id: int, hours: int = 24, limit: int = 500,
                 auth=Depends(checks_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    device = db.query(Device).filter(Device.id == device_id, Device.organization_id == org.id).first()
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return (
        db.query(CheckResult)
        .filter(CheckResult.device_id == device_id,
                CheckResult.organization_id == org.id,
                CheckResult.timestamp >= utcnow() - timedelta(hours=hours))
        .order_by(CheckResult.timestamp.desc())
        .limit(limit)
        .all()
    )


@router.get("/devices/{device_id}/latest")
def latest_status(device_id: int, auth=Depends(checks_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    device = db.query(Device).filter(Device.id == device_id, Device.organization_id == org.id).first()
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    result = (
        db.query(CheckResult)
        .filter(CheckResult.device_id == device_id, CheckResult.organization_id == org.id)
        .order_by(CheckResult.timestamp.desc())
        .first()
    )
    return {
        "device_id": device.id,
        "status": result.status if result else device.status,
        "latency_ms": result.latency if result else None,
        "packet_loss_pct": result.packet_loss if result else None,
        "timestamp": result.timestamp if result else None,
    }


# ─── Port scanner ──────────────────────────────────────────────
@router.post("/port-scan", response_model=PortScanResponse)
def port_scan(body: PortScanRequest, auth=Depends(checks_manage)):
    start, end = body.start_port, body.end_port
    if start < 1 or end > 65535 or start > end:
        raise HTTPException(status_code=422, detail="Invalid port range (1-65535)")
    ports = list(range(start, end + 1))
    if len(ports) > 5000:
        raise HTTPException(status_code=422, detail="Too many ports (max 5000)")
    import time

    started = time.time()
    open_ports = []
    for port in ports:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(1)
                if sock.connect_ex((body.target_ip, port)) == 0:
                    open_ports.append({"port": port, "service": "", "banner": ""})
        except socket.gaierror:
            raise HTTPException(status_code=422, detail=f"Cannot resolve host: {body.target_ip}")
        except OSError:
            pass
    return PortScanResponse(target_ip=body.target_ip, open_ports=open_ports,
                            total_scanned=len(ports), scan_time=f"{time.time() - started:.2f}s")
