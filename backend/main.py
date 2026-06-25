from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
import subprocess
import platform
import socket
import os
import asyncio
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from database import engine, get_db, Base
from models import User, Device, Role, Permission, DeviceStatusHistory
from schemas import (
    UserResponse, Token, TokenWithPermissions,
    DeviceCreate, DeviceUpdate, DeviceResponse, DeviceImport,
    AdminUserCreate, UserRoleUpdate, PortScanRequest, PortScanResponse, PortResult,
    RoleResponse, PermissionResponse,
)
from auth import (
    hash_password, verify_password, create_access_token, get_current_user,
    get_user_permissions, require_permission,
)

Base.metadata.create_all(bind=engine)


def get_visible_devices(db: Session, current_user: User):
    return db.query(Device)


def seed_roles_and_permissions(db: Session):
    permissions_data = [
        ("create_users", "Create new user accounts"),
        ("manage_users", "View and manage all users"),
        ("create_devices", "Add devices to monitoring"),
        ("import_devices", "Import devices from Excel/CSV"),
        ("export_devices", "Export devices to Excel"),
        ("view_dashboard", "View device monitoring dashboard"),
        ("port_scanning", "Use port scanner tool"),
    ]

    permissions = {}
    for name, desc in permissions_data:
        perm = db.query(Permission).filter(Permission.name == name).first()
        if not perm:
            perm = Permission(name=name, description=desc)
            db.add(perm)
            db.flush()
        permissions[name] = perm

    roles_data = [
        ("admin", "Administrator with full access", list(permissions.values())),
        ("user", "Regular user with limited access", [
            permissions["create_devices"],
            permissions["export_devices"],
            permissions["view_dashboard"],
            permissions["port_scanning"],
        ]),
    ]

    roles = {}
    for name, desc, perms in roles_data:
        role = db.query(Role).filter(Role.name == name).first()
        if not role:
            role = Role(name=name, description=desc)
            db.add(role)
            db.flush()
        role.permissions = perms
        roles[name] = role

    db.commit()
    return roles


db = next(get_db())
roles = seed_roles_and_permissions(db)

admin_role = db.query(Role).filter(Role.name == "admin").first()
user_role = db.query(Role).filter(Role.name == "user").first()

admin = db.query(User).filter(User.is_admin == True).first()
if not admin:
    akashdeep = db.query(User).filter(User.username == "akashdeep").first()
    if akashdeep:
        akashdeep.is_admin = True
        akashdeep.role_id = admin_role.id
        db.commit()
    else:
        admin_user = User(
            username="akashdeep",
            email="akashdeep@localhost",
            hashed_password=hash_password("Admin@123"),
            is_admin=True,
            role_id=admin_role.id,
        )
        db.add(admin_user)
        db.commit()

existing_users = db.query(User).filter(User.role_id == None).all()
for user in existing_users:
    if user.is_admin:
        user.role_id = admin_role.id
    else:
        user.role_id = user_role.id
db.commit()
db.close()


async def background_ping_loop():
    await asyncio.sleep(10)
    while True:
        try:
            db = next(get_db())
            devices = db.query(Device).all()
            if devices:
                ips = [d.ip_address for d in devices]
                with ThreadPoolExecutor(max_workers=20) as pool:
                    results = list(pool.map(ping_ip, ips))
                now = datetime.now(timezone.utc)
                for device, result in zip(devices, results):
                    device.status = result["status"]
                    device.latency = result["latency"]
                    device.updated_at = now
                    history = DeviceStatusHistory(
                        device_id=device.id,
                        status=result["status"],
                        latency=result["latency"],
                        checked_at=now,
                    )
                    db.add(history)
                db.commit()
            db.close()
        except Exception:
            pass
        await asyncio.sleep(300)



@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(background_ping_loop())
    yield

app = FastAPI(title="Ping Monitor API", version="1.0.0", lifespan=lifespan)

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Auth Routes ───────────────────────────────────────────────

@app.post("/api/auth/login", response_model=TokenWithPermissions)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": str(user.id)})
    permissions = get_user_permissions(user)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "permissions": permissions,
        "is_admin": user.is_admin,
    }


@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    permissions = get_user_permissions(current_user)
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "is_admin": current_user.is_admin,
        "role_id": current_user.role_id,
        "role_name": current_user.role.name if current_user.role else None,
        "permissions": permissions,
        "created_at": current_user.created_at,
    }


@app.get("/api/auth/permissions")
def get_permissions(current_user: User = Depends(get_current_user)):
    return {"permissions": get_user_permissions(current_user)}


@app.post("/api/auth/create-user", response_model=UserResponse)
def create_user(
    user: AdminUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("create_users")),
):
    if " " in user.username:
        raise HTTPException(status_code=400, detail="Username cannot contain spaces")
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")

    role_id = user.role_id
    if not role_id:
        role_id = user_role.id

    new_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hash_password(user.password),
        role_id=role_id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    permissions = get_user_permissions(new_user)
    return {
        "id": new_user.id,
        "username": new_user.username,
        "email": new_user.email,
        "is_admin": new_user.is_admin,
        "role_id": new_user.role_id,
        "role_name": new_user.role.name if new_user.role else None,
        "permissions": permissions,
        "created_at": new_user.created_at,
    }


@app.get("/api/auth/users", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_users")),
):
    users = db.query(User).all()
    result = []
    for u in users:
        permissions = get_user_permissions(u)
        result.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "is_admin": u.is_admin,
            "role_id": u.role_id,
            "role_name": u.role.name if u.role else None,
            "permissions": permissions,
            "created_at": u.created_at,
        })
    return result


@app.put("/api/auth/users/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    data: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_users")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = db.query(Role).filter(Role.id == data.role_id).first()
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role")

    user.role_id = data.role_id
    if role.name == "admin":
        user.is_admin = True
    else:
        user.is_admin = False

    db.commit()
    db.refresh(user)

    permissions = get_user_permissions(user)
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_admin": user.is_admin,
        "role_id": user.role_id,
        "role_name": user.role.name if user.role else None,
        "permissions": permissions,
        "created_at": user.created_at,
    }


@app.delete("/api/auth/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_users")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    db.delete(user)
    db.commit()
    return {"detail": "User deleted"}


@app.get("/api/auth/roles", response_model=list[RoleResponse])
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Role).all()


# ─── Device Routes ─────────────────────────────────────────────

@app.get("/api/devices", response_model=list[DeviceResponse])
def get_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_visible_devices(db, current_user).all()


@app.post("/api/devices", response_model=DeviceResponse)
def create_device(
    device: DeviceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("create_devices")),
):
    existing = db.query(Device).filter(Device.ip_address == device.ip_address).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"IP address '{device.ip_address}' already exists in the database")

    new_device = Device(
        name=device.name,
        ip_address=device.ip_address,
        status="Offline",
        owner_id=current_user.id,
    )
    db.add(new_device)
    db.commit()
    db.refresh(new_device)
    return new_device


@app.put("/api/devices/{device_id}", response_model=DeviceResponse)
def update_device(
    device_id: int,
    device: DeviceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_device = (
        db.query(Device)
        .filter(Device.id == device_id)
        .first()
    )
    if not db_device:
        raise HTTPException(status_code=404, detail="Device not found")

    if device.name is not None:
        db_device.name = device.name
    if device.ip_address is not None:
        db_device.ip_address = device.ip_address
    if device.status is not None:
        db_device.status = device.status

    db_device.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_device)
    return db_device


@app.delete("/api/devices/{device_id}")
def delete_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_device = (
        db.query(Device)
        .filter(Device.id == device_id)
        .first()
    )
    if not db_device:
        raise HTTPException(status_code=404, detail="Device not found")

    db.delete(db_device)
    db.commit()
    return {"detail": "Device deleted"}


@app.post("/api/devices/bulk-delete")
def bulk_delete_devices(
    device_ids: list[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("create_devices")),
):
    deleted = db.query(Device).filter(Device.id.in_(device_ids)).delete(synchronize_session=False)
    db.commit()
    return {"detail": f"{deleted} device(s) deleted"}


# ─── Ping Route ────────────────────────────────────────────────

def ping_ip(ip: str):
    try:
        if platform.system().lower() == "windows":
            output = subprocess.run(
                ["ping", "-n", "1", "-w", "1000", ip],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5,
            )
        else:
            output = subprocess.run(
                ["ping", "-c", "1", "-W", "1", ip],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5,
            )
        result = output.stdout.lower()
        latency = None
        if "time=" in result:
            try:
                time_str = result.split("time=")[1].split("ms")[0].strip()
                latency = float(time_str)
            except (ValueError, IndexError):
                pass
        if "ttl=" in result and "unreachable" not in result and "timed out" not in result:
            return {"status": "Online", "latency": latency}
        return {"status": "Offline", "latency": None}
    except Exception:
        return {"status": "Offline", "latency": None}


@app.get("/api/devices/{device_id}/ping", response_model=DeviceResponse)
def ping_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_device = (
        db.query(Device)
        .filter(Device.id == device_id)
        .first()
    )
    if not db_device:
        raise HTTPException(status_code=404, detail="Device not found")

    result = ping_ip(db_device.ip_address)
    db_device.status = result["status"]
    db_device.latency = result["latency"]
    db_device.updated_at = datetime.now(timezone.utc)

    history = DeviceStatusHistory(
        device_id=db_device.id,
        status=result["status"],
        latency=result["latency"],
    )
    db.add(history)
    db.commit()
    db.refresh(db_device)
    return db_device


@app.post("/api/devices/ping-all", response_model=list[DeviceResponse])
def ping_all_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    devices = get_visible_devices(db, current_user).all()
    ips = [d.ip_address for d in devices]
    with ThreadPoolExecutor(max_workers=20) as pool:
        results = list(pool.map(ping_ip, ips))
    now = datetime.now(timezone.utc)
    for device, result in zip(devices, results):
        device.status = result["status"]
        device.latency = result["latency"]
        device.updated_at = now
        history = DeviceStatusHistory(
            device_id=device.id,
            status=result["status"],
            latency=result["latency"],
            checked_at=now,
        )
        db.add(history)
    db.commit()
    for device in devices:
        db.refresh(device)
    return devices


# ─── Import / Export ───────────────────────────────────────────

@app.post("/api/devices/import", response_model=list[DeviceResponse])
def import_devices(
    data: DeviceImport,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("import_devices")),
):
    existing_ips = {d.ip_address for d in db.query(Device).all()}
    new_devices = []
    skipped = []

    for d in data.devices:
        if d.ip_address in existing_ips:
            skipped.append(d.ip_address)
            continue
        device = Device(
            name=d.name,
            ip_address=d.ip_address,
            status="Offline",
            owner_id=current_user.id,
        )
        db.add(device)
        new_devices.append(device)
        existing_ips.add(d.ip_address)

    db.commit()
    for device in new_devices:
        db.refresh(device)

    return new_devices


@app.get("/api/devices/export")
def export_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("export_devices")),
):
    devices = get_visible_devices(db, current_user).all()
    return [
        {"Name": d.name, "IP": d.ip_address, "Status": d.status}
        for d in devices
    ]


# ─── Reports & Analytics ──────────────────────────────────────

@app.get("/api/reports/overview")
def get_reports_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    devices = get_visible_devices(db, current_user).all()
    total = len(devices)
    online = sum(1 for d in devices if d.status == "Online")
    offline = total - online
    avg_latency = None
    latencies = [d.latency for d in devices if d.latency is not None]
    if latencies:
        avg_latency = round(sum(latencies) / len(latencies), 2)

    return {
        "total_devices": total,
        "online": online,
        "offline": offline,
        "uptime_percentage": round((online / total * 100), 2) if total > 0 else 0,
        "average_latency": avg_latency,
    }


@app.get("/api/reports/device/{device_id}/history")
def get_device_history(
    device_id: int,
    hours: int = 24,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    from datetime import timedelta
    now_naive = datetime.utcnow()
    since = now_naive - timedelta(hours=hours)
    history = (
        db.query(DeviceStatusHistory)
        .filter(DeviceStatusHistory.device_id == device_id)
        .filter(DeviceStatusHistory.checked_at >= since)
        .order_by(DeviceStatusHistory.checked_at.desc())
        .all()
    )

    total_checks = len(history)
    online_checks = sum(1 for h in history if h.status == "Online")
    uptime = round((online_checks / total_checks * 100), 2) if total_checks > 0 else 0

    latencies = [h.latency for h in history if h.latency is not None]
    avg_latency = round(sum(latencies) / len(latencies), 2) if latencies else None
    min_latency = min(latencies) if latencies else None
    max_latency = max(latencies) if latencies else None

    return {
        "device": {
            "id": device.id,
            "name": device.name,
            "ip_address": device.ip_address,
            "current_status": device.status,
        },
        "period_hours": hours,
        "total_checks": total_checks,
        "online_checks": online_checks,
        "offline_checks": total_checks - online_checks,
        "uptime_percentage": uptime,
        "avg_latency": avg_latency,
        "min_latency": min_latency,
        "max_latency": max_latency,
        "history": [
            {
                "status": h.status,
                "latency": h.latency,
                "checked_at": h.checked_at.isoformat() if h.checked_at.tzinfo else h.checked_at.replace(tzinfo=timezone.utc).isoformat(),
            }
            for h in history
        ],
    }


@app.get("/api/reports/downtime")
def get_downtime_log(
    hours: int = 24,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import timedelta
    now_naive = datetime.utcnow()
    since = now_naive - timedelta(hours=hours)

    devices = get_visible_devices(db, current_user).all()
    downtime_events = []

    for device in devices:
        history = (
            db.query(DeviceStatusHistory)
            .filter(DeviceStatusHistory.device_id == device.id)
            .filter(DeviceStatusHistory.checked_at >= since)
            .order_by(DeviceStatusHistory.checked_at.asc())
            .all()
        )

        offline_start = None
        for h in history:
            if h.status == "Offline" and offline_start is None:
                offline_start = h.checked_at
            elif h.status == "Online" and offline_start is not None:
                duration = (h.checked_at - offline_start).total_seconds()
                downtime_events.append({
                    "device_id": device.id,
                    "device_name": device.name,
                    "ip_address": device.ip_address,
                    "started_at": offline_start.isoformat(),
                    "ended_at": h.checked_at.isoformat(),
                    "duration_seconds": round(duration),
                    "duration_human": str(timedelta(seconds=int(duration))),
                })
                offline_start = None

        if offline_start is not None:
            duration = (now_naive - offline_start).total_seconds()
            downtime_events.append({
                "device_id": device.id,
                "device_name": device.name,
                "ip_address": device.ip_address,
                "started_at": offline_start.isoformat(),
                "ended_at": None,
                "duration_seconds": round(duration),
                "duration_human": str(timedelta(seconds=int(duration))) + " (ongoing)",
            })

    downtime_events.sort(key=lambda x: x["started_at"], reverse=True)
    return downtime_events


@app.get("/api/reports/all-devices")
def get_all_devices_report(
    hours: int = 24,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import timedelta
    now_naive = datetime.utcnow()
    since = now_naive - timedelta(hours=hours)
    devices = get_visible_devices(db, current_user).all()
    report = []

    for device in devices:
        history = (
            db.query(DeviceStatusHistory)
            .filter(DeviceStatusHistory.device_id == device.id)
            .filter(DeviceStatusHistory.checked_at >= since)
            .all()
        )

        total_checks = len(history)
        online_checks = sum(1 for h in history if h.status == "Online")
        uptime = round((online_checks / total_checks * 100), 2) if total_checks > 0 else 0
        latencies = [h.latency for h in history if h.latency is not None]
        avg_latency = round(sum(latencies) / len(latencies), 2) if latencies else None

        report.append({
            "device_id": device.id,
            "device_name": device.name,
            "ip_address": device.ip_address,
            "current_status": device.status,
            "current_latency": device.latency,
            "total_checks": total_checks,
            "online_checks": online_checks,
            "offline_checks": total_checks - online_checks,
            "uptime_percentage": uptime,
            "avg_latency": avg_latency,
        })

    report.sort(key=lambda x: x["uptime_percentage"])
    return report


# ─── Port Scanner ─────────────────────────────────────────────

SERVICES = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
    80: "HTTP", 110: "POP3", 143: "IMAP", 443: "HTTPS", 445: "SMB",
    993: "IMAPS", 995: "POP3S", 1433: "MSSQL", 3306: "MySQL",
    3389: "RDP", 5432: "PostgreSQL", 5900: "VNC", 6379: "Redis",
    8080: "HTTP-Alt", 8443: "HTTPS-Alt", 27017: "MongoDB",
}


def _scan_port(ip, port):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.3)
            if sock.connect_ex((ip, port)) == 0:
                banner = ""
                try:
                    sock.settimeout(0.5)
                    sock.setblocking(False)
                    try:
                        data = sock.recv(1024)
                        if data:
                            banner = data.decode("utf-8", errors="replace").strip()[:45]
                    except BlockingIOError:
                        pass
                except Exception:
                    pass
                return PortResult(port=port, service=SERVICES.get(port, ""), banner=banner or "-")
    except Exception:
        pass
    return None


@app.post("/api/scan", response_model=PortScanResponse)
def scan_ports(
    req: PortScanRequest,
    current_user: User = Depends(require_permission("port_scanning")),
):
    try:
        socket.inet_aton(req.target_ip)
    except socket.error:
        raise HTTPException(status_code=400, detail="Invalid IP address")

    start = max(1, req.start_port)
    end = min(65535, req.end_port)
    if start > end:
        raise HTTPException(status_code=400, detail="Start port must be <= end port")

    threads = min(req.threads, end - start + 1)
    ports = list(range(start, end + 1))

    t0 = datetime.now()
    open_ports = []
    with ThreadPoolExecutor(max_workers=threads) as pool:
        futures = [pool.submit(_scan_port, req.target_ip, p) for p in ports]
        for f in futures:
            result = f.result()
            if result:
                open_ports.append(result)

    open_ports.sort(key=lambda x: x.port)
    elapsed = str(datetime.now() - t0).split(".")[0]

    return PortScanResponse(
        target_ip=req.target_ip,
        open_ports=open_ports,
        total_scanned=len(ports),
        scan_time=elapsed,
    )


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)
