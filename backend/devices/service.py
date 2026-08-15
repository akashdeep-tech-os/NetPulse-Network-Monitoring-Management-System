"""Device, group and check management (always scoped to an organization)."""
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.security import utcnow
from models import Device, DeviceCheck, DeviceGroup
from tenants.service import enforce_limit


# ─── Devices ───────────────────────────────────────────────────
def list_devices(db: Session, organization_id: int, group_id: Optional[int] = None,
                 device_type: Optional[str] = None, status: Optional[str] = None,
                 location: Optional[str] = None, search: Optional[str] = None,
                 limit: int = 200, offset: int = 0) -> tuple[list[Device], int]:
    query = db.query(Device).filter(Device.organization_id == organization_id)
    if group_id:
        query = query.filter(Device.group_id == group_id)
    if device_type:
        query = query.filter(Device.device_type == device_type)
    if status:
        query = query.filter(Device.status == status)
    if location:
        query = query.filter(Device.location == location)
    if search:
        like = f"%{search}%"
        query = query.filter((Device.name.ilike(like)) | (Device.ip_address.ilike(like)) | (Device.hostname.ilike(like)))
    total = query.count()
    devices = query.order_by(Device.created_at.desc()).offset(offset).limit(limit).all()
    return devices, total


def get_device(db: Session, organization_id: int, device_id: int) -> Device:
    device = (
        db.query(Device)
        .filter(Device.id == device_id, Device.organization_id == organization_id)
        .first()
    )
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


def create_device(db: Session, organization_id: int, owner_user_id: int, data: dict, max_devices: int) -> Device:
    enforce_limit(db, organization_id, "devices", max_devices, "Device")
    ip = data.get("ip_address", "").strip()
    existing = (
        db.query(Device)
        .filter(Device.organization_id == organization_id, Device.ip_address == ip)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail=f"IP address '{ip}' already exists in this organization")
    group_id = data.get("group_id")
    if group_id:
        db.query(DeviceGroup).filter(DeviceGroup.id == group_id, DeviceGroup.organization_id == organization_id).one_or_none() or _group_missing()

    device = Device(
        organization_id=organization_id,
        group_id=group_id,
        name=data["name"],
        hostname=data.get("hostname"),
        ip_address=ip,
        device_type=data.get("device_type", "Server"),
        description=data.get("description"),
        location=data.get("location"),
        status="Offline",
        monitoring_enabled=data.get("monitoring_enabled", True),
        monitoring_interval=data.get("monitoring_interval"),
        created_by=owner_user_id,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


def _group_missing():
    raise HTTPException(status_code=400, detail="Group not found in this organization")


def update_device(db: Session, organization_id: int, device_id: int, data: dict) -> Device:
    device = get_device(db, organization_id, device_id)
    if "group_id" in data and data["group_id"] is not None:
        group = db.query(DeviceGroup).filter(DeviceGroup.id == data["group_id"], DeviceGroup.organization_id == organization_id).first()
        if group is None:
            raise HTTPException(status_code=400, detail="Group not found in this organization")
        device.group_id = group.id
    for key in ("name", "hostname", "ip_address", "device_type", "description", "location",
                "monitoring_enabled", "monitoring_interval"):
        if key in data and data[key] is not None:
            setattr(device, key, data[key])
    device.updated_at = utcnow()
    db.commit()
    db.refresh(device)
    return device


def delete_device(db: Session, organization_id: int, device_id: int) -> None:
    device = get_device(db, organization_id, device_id)
    db.delete(device)
    db.commit()


def bulk_delete_devices(db: Session, organization_id: int, device_ids: list[int]) -> int:
    deleted = (
        db.query(Device)
        .filter(Device.organization_id == organization_id, Device.id.in_(device_ids))
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted


# ─── Groups ────────────────────────────────────────────────────
def list_groups(db: Session, organization_id: int) -> list[dict]:
    groups = db.query(DeviceGroup).filter(DeviceGroup.organization_id == organization_id).order_by(DeviceGroup.name).all()
    result = []
    for g in groups:
        count = db.query(Device).filter(Device.group_id == g.id).count()
        result.append({**{c.name: getattr(g, c.name) for c in g.__table__.columns}, "device_count": count})
    return result


def get_group(db: Session, organization_id: int, group_id: int) -> DeviceGroup:
    group = db.query(DeviceGroup).filter(DeviceGroup.id == group_id, DeviceGroup.organization_id == organization_id).first()
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


def create_group(db: Session, organization_id: int, name: str, description: Optional[str], color: str, max_groups: int) -> DeviceGroup:
    enforce_limit(db, organization_id, "groups", max_groups, "Group")
    existing = db.query(DeviceGroup).filter(DeviceGroup.organization_id == organization_id, DeviceGroup.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Group name already exists")
    group = DeviceGroup(organization_id=organization_id, name=name, description=description, color=color)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


def update_group(db: Session, organization_id: int, group_id: int, data: dict) -> DeviceGroup:
    group = get_group(db, organization_id, group_id)
    if "name" in data and data["name"]:
        existing = db.query(DeviceGroup).filter(
            DeviceGroup.organization_id == organization_id,
            DeviceGroup.name == data["name"],
            DeviceGroup.id != group_id,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Group name already exists")
        group.name = data["name"]
    if "description" in data:
        group.description = data["description"]
    if "color" in data and data["color"]:
        group.color = data["color"]
    db.commit()
    db.refresh(group)
    return group


def delete_group(db: Session, organization_id: int, group_id: int) -> None:
    group = get_group(db, organization_id, group_id)
    db.query(Device).filter(Device.group_id == group_id, Device.organization_id == organization_id).update({"group_id": None})
    db.delete(group)
    db.commit()


# ─── Checks ────────────────────────────────────────────────────
def list_checks(db: Session, organization_id: int, device_id: Optional[int] = None) -> list[DeviceCheck]:
    query = db.query(DeviceCheck).filter(DeviceCheck.organization_id == organization_id)
    if device_id:
        query = query.filter(DeviceCheck.device_id == device_id)
    return query.order_by(DeviceCheck.created_at.desc()).all()


def get_check(db: Session, organization_id: int, check_id: int) -> DeviceCheck:
    check = db.query(DeviceCheck).filter(DeviceCheck.id == check_id, DeviceCheck.organization_id == organization_id).first()
    if check is None:
        raise HTTPException(status_code=404, detail="Check not found")
    return check


def create_check(db: Session, organization_id: int, device_id: int, data: dict) -> DeviceCheck:
    device = get_device(db, organization_id, device_id)
    check = DeviceCheck(
        organization_id=organization_id,
        device_id=device.id,
        name=data["name"],
        check_type=data["check_type"],
        host=data.get("host"),
        port=data.get("port"),
        url=data.get("url"),
        expected_status_code=data.get("expected_status_code"),
        timeout_seconds=data.get("timeout_seconds", 5),
        enabled=data.get("enabled", True),
    )
    db.add(check)
    db.commit()
    db.refresh(check)
    return check


def update_check(db: Session, organization_id: int, check_id: int, data: dict) -> DeviceCheck:
    check = get_check(db, organization_id, check_id)
    for key in ("name", "host", "port", "url", "expected_status_code", "timeout_seconds", "enabled"):
        if key in data and data[key] is not None:
            setattr(check, key, data[key])
    db.commit()
    db.refresh(check)
    return check


def delete_check(db: Session, organization_id: int, check_id: int) -> None:
    check = get_check(db, organization_id, check_id)
    db.delete(check)
    db.commit()


def run_check_now(db: Session, organization_id: int, check_id: int) -> DeviceCheck:
    """Immediately executes a single check (used by 'Run Now')."""
    check = get_check(db, organization_id, check_id)
    from monitoring.engine import execute_check
    from tenants.service import get_org_plan, get_organization

    org = get_organization(db, organization_id)
    plan = get_org_plan(db, org)
    execute_check(db, check, plan.monitoring_interval)
    db.refresh(check)
    return check
