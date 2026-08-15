"""Device and group endpoints (org-scoped)."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from audit.service import log_action
from core.dependencies import AuthContext, get_auth_context, get_db, require_permission
from devices import service as devices_service
from models import Device, Organization
from schemas import DeviceCreate, DeviceImportRequest, DeviceOut, DeviceUpdate, Message
from tenants.service import get_org_plan, get_organization

router = APIRouter(prefix="/devices", tags=["devices"])

devices_perm = require_permission("devices.view")
devices_manage = require_permission("devices.edit")


def _org(db: Session, auth: AuthContext) -> Organization:
    if auth.org_id is None:
        raise HTTPException(status_code=400, detail="No organization context")
    return get_organization(db, auth.org_id)


@router.get("", response_model=list[DeviceOut])
def list_devices(group_id: Optional[int] = None, search: Optional[str] = None,
                 auth=Depends(devices_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    devices, _ = devices_service.list_devices(db, org.id, group_id=group_id, search=search)
    return devices


@router.post("", response_model=DeviceOut)
def create_device(body: DeviceCreate, auth=Depends(devices_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    plan = get_org_plan(db, org)
    owner = auth.user.id if auth.user else 0
    device = devices_service.create_device(db, org.id, owner, body.model_dump(), plan.max_devices)
    log_action(db, "device.create", "device", str(device.id), organization_id=org.id)
    db.commit()
    return device


@router.post("/import", response_model=list[DeviceOut])
def import_devices(body: DeviceImportRequest, auth=Depends(devices_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    plan = get_org_plan(db, org)
    owner = auth.user.id if auth.user else 0
    existing_ips = {ip for (ip,) in db.query(Device.ip_address).filter(Device.organization_id == org.id).all()}
    count = db.query(Device).filter(Device.organization_id == org.id).count()
    added = []
    for item in body.devices:
        ip = item.ip_address.strip()
        if not ip or ip in existing_ips or count >= plan.max_devices:
            continue
        existing_ips.add(ip)
        count += 1
        device = Device(organization_id=org.id, name=item.name, ip_address=ip,
                        status="Offline", monitoring_enabled=True, created_by=owner)
        db.add(device)
        added.append(device)
    if added:
        db.commit()
        for d in added:
            db.refresh(d)
        log_action(db, "device.import", "device", f"{len(added)} devices", organization_id=org.id)
        db.commit()
    return added


@router.get("/{device_id}", response_model=DeviceOut)
def get_device(device_id: int, auth=Depends(devices_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return devices_service.get_device(db, org.id, device_id)


@router.patch("/{device_id}", response_model=DeviceOut)
def update_device(device_id: int, body: DeviceUpdate, auth=Depends(devices_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    device = devices_service.update_device(db, org.id, device_id, body.model_dump(exclude_unset=True))
    log_action(db, "device.update", "device", str(device_id), organization_id=org.id)
    db.commit()
    return device


@router.delete("/{device_id}", response_model=Message)
def delete_device(device_id: int, auth=Depends(devices_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    devices_service.delete_device(db, org.id, device_id)
    log_action(db, "device.delete", "device", str(device_id), organization_id=org.id)
    db.commit()
    return Message(message="Device deleted")


# ─── Groups ────────────────────────────────────────────────────
@router.get("/groups/list")
def list_groups(auth=Depends(devices_perm), db: Session = Depends(get_db)):
    org = _org(db, auth)
    return devices_service.list_groups(db, org.id)


@router.post("/groups")
def create_group(name: str, description: Optional[str] = None, color: str = "#3b82f6",
                 auth=Depends(devices_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    plan = get_org_plan(db, org)
    group = devices_service.create_group(db, org.id, name, description, color, plan.max_groups)
    log_action(db, "group.create", "group", str(group.id), organization_id=org.id)
    db.commit()
    return {"id": group.id, "name": group.name, "description": group.description, "color": group.color}


@router.patch("/groups/{group_id}")
def update_group(group_id: int, name: Optional[str] = None, description: Optional[str] = None,
                 color: Optional[str] = None, auth=Depends(devices_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    data = {k: v for k, v in {"name": name, "description": description, "color": color}.items() if v is not None}
    group = devices_service.update_group(db, org.id, group_id, data)
    log_action(db, "group.update", "group", str(group_id), organization_id=org.id)
    db.commit()
    return {"id": group.id, "name": group.name, "description": group.description, "color": group.color}


@router.delete("/groups/{group_id}", response_model=Message)
def delete_group(group_id: int, auth=Depends(devices_manage), db: Session = Depends(get_db)):
    org = _org(db, auth)
    devices_service.delete_group(db, org.id, group_id)
    log_action(db, "group.delete", "group", str(group_id), organization_id=org.id)
    db.commit()
    return Message(message="Group deleted")
