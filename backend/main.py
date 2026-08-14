from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict
import subprocess
import platform
import socket
import os
import sys
import asyncio
import secrets
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# ─── Single instance guard ─────────────────────────────────────
_lock_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    _lock_socket.bind(("127.0.0.1", 47583))
    _lock_socket.listen(1)
except OSError:
    print("Ping Monitor is already running.")
    if getattr(sys, "frozen", False):
        input("Press Enter to exit...")
    sys.exit(0)

load_dotenv()
if getattr(sys, "frozen", False):
    load_dotenv(os.path.join(os.path.dirname(sys.executable), ".env"))

from database import engine, get_db, Base, DATA_DIR
from models import User, Device, Role, Permission, DeviceStatusHistory, DeviceGroup, AlertRule, AlertLog, AlertConfig
from schemas import (
    UserResponse, Token, TokenWithPermissions,
    DeviceCreate, DeviceUpdate, DeviceResponse, DeviceImport,
    AdminUserCreate, UserRoleUpdate, ChangePasswordRequest, PortScanRequest, PortScanResponse, PortResult,
    RoleResponse, PermissionResponse,
    DeviceGroupCreate, DeviceGroupUpdate, DeviceGroupResponse,
    AlertRuleCreate, AlertRuleUpdate, AlertRuleResponse, AlertLogResponse, NotificationTestRequest,
    AlertConfigUpdate, AlertConfigResponse,
)
from auth import (
    hash_password, verify_password, create_access_token, get_current_user,
    get_user_permissions, require_permission,
)
from notifications import send_alert_notification, test_notification
from sqlalchemy import text

Base.metadata.create_all(bind=engine)

# Auto-migrate: add group_id column if missing
try:
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(devices)"))
        columns = [row[1] for row in result]
        if "group_id" not in columns:
            conn.execute(text("ALTER TABLE devices ADD COLUMN group_id INTEGER REFERENCES device_groups(id)"))
            conn.commit()
except Exception:
    pass


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
    admin_username = os.getenv("ADMIN_USERNAME", "Surakshitcity")
    admin_email = os.getenv("ADMIN_EMAIL", "admin@localhost.local")
    admin_password = os.getenv("ADMIN_PASSWORD", "")

    admin_existing = db.query(User).filter(User.username == admin_username).first()
    if admin_existing:
        admin_existing.is_admin = True
        admin_existing.role_id = admin_role.id
        db.commit()
    else:
        generated_password = False
        if not admin_password:
            admin_password = secrets.token_urlsafe(12)
            generated_password = True
        admin_user = User(
            username=admin_username,
            email=admin_email,
            hashed_password=hash_password(admin_password),
            is_admin=True,
            role_id=admin_role.id,
        )
        db.add(admin_user)
        db.commit()

        creds_file = os.path.join(DATA_DIR, "admin_credentials.txt")
        try:
            with open(creds_file, "w") as f:
                f.write(f"Ping Monitor - initial administrator account\n")
                f.write(f"Username: {admin_username}\n")
                f.write(f"Password: {admin_password}\n")
                f.write("Change this password after first login, then delete this file.\n")
        except Exception:
            pass

        sep = "=" * 60
        print(f"\n{sep}")
        print("  NO ADMINISTRATOR ACCOUNT FOUND - CREATED ONE")
        print("  Username: {}".format(admin_username))
        if generated_password:
            print("  Password: {}  (auto-generated)".format(admin_password))
            print("  Saved to: {}".format(creds_file))
        else:
            print("  Password: (set via ADMIN_PASSWORD env variable)")
        print("  IMPORTANT: Change this password after your first login.")
        print(f"{sep}\n")
    db.close()

# Warn if the legacy hardcoded default password is still in use
existing_admin = db.query(User).filter(User.is_admin == True).first()
if existing_admin and verify_password("Surakshitcity@1237", existing_admin.hashed_password):
    print("\nWARNING: The default administrator password is still in use.")
    print("This is a serious security risk. Change it immediately.")
    print("(Default password detected: Surakshitcity@1237)\n")

existing_users = db.query(User).filter(User.role_id == None).all()
for user in existing_users:
    if user.is_admin:
        user.role_id = admin_role.id
    else:
        user.role_id = user_role.id
db.commit()
db.close()


def get_alert_config_value(db, key, default=""):
    config = db.query(AlertConfig).filter(AlertConfig.key == key).first()
    return config.value if config else default


def set_alert_config_value(db, key, value):
    config = db.query(AlertConfig).filter(AlertConfig.key == key).first()
    if config:
        config.value = value
    else:
        config = AlertConfig(key=key, value=value)
        db.add(config)
    db.commit()


# ─── Login rate limiting ──────────────────────────────────────
LOGIN_MAX_ATTEMPTS = int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"))
LOGIN_WINDOW_MINUTES = int(os.getenv("LOGIN_WINDOW_MINUTES", "15"))
_login_attempts: dict[str, list] = defaultdict(list)


def _prune_login_attempts(key: str):
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=LOGIN_WINDOW_MINUTES)
    _login_attempts[key] = [t for t in _login_attempts[key] if t > cutoff]


def _is_login_limited(request: Request, username: str) -> bool:
    client_ip = request.client.host if request.client else "unknown"
    for key in (f"ip:{client_ip}", f"user:{username.lower()}"):
        _prune_login_attempts(key)
        if len(_login_attempts[key]) >= LOGIN_MAX_ATTEMPTS:
            return True
    return False


def _record_failed_login(request: Request, username: str):
    client_ip = request.client.host if request.client else "unknown"
    now = datetime.now(timezone.utc)
    _login_attempts[f"ip:{client_ip}"].append(now)
    _login_attempts[f"user:{username.lower()}"].append(now)


def _clear_failed_logins(username: str):
    _login_attempts.pop(f"user:{username.lower()}", None)


def _rate_limit_exception():
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Too many failed login attempts. Try again in {LOGIN_WINDOW_MINUTES} minutes.",
        headers={"Retry-After": str(LOGIN_WINDOW_MINUTES * 60)},
    )


# ─── Security headers middleware ──────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if not getattr(request.state, "skip_cache", False):
            response.headers["Cache-Control"] = "no-store"
        return response


def evaluate_alerts(db, device_results: list[tuple]):
    """Evaluate alert rules after a ping cycle and send notifications."""
    rules = db.query(AlertRule).filter(AlertRule.enabled == True).all()
    if not rules:
        return

    for rule in rules:
        devices_to_check = []
        if rule.target_type == "all":
            devices_to_check = db.query(Device).all()
        elif rule.target_type == "group":
            devices_to_check = db.query(Device).filter(Device.group_id == rule.target_id).all()
        elif rule.target_type == "device":
            device = db.query(Device).filter(Device.id == rule.target_id).first()
            if device:
                devices_to_check = [device]

        triggered_devices = []

        for device in devices_to_check:
            if rule.rule_type == "device_offline" and device.status == "Offline":
                triggered_devices.append(device)
            elif rule.rule_type == "device_online" and device.status == "Online":
                triggered_devices.append(device)
            elif rule.rule_type == "high_latency":
                if device.latency is not None and rule.threshold_value is not None:
                    if device.latency > rule.threshold_value:
                        triggered_devices.append(device)

        if not triggered_devices:
            continue

        last_log = (
            db.query(AlertLog)
            .filter(AlertLog.rule_id == rule.id)
            .order_by(AlertLog.created_at.desc())
            .first()
        )
        if last_log:
            from datetime import timedelta
            cooldown = timedelta(minutes=rule.cooldown_minutes)
            if (datetime.now(timezone.utc) - last_log.created_at.replace(tzinfo=timezone.utc)) < cooldown:
                continue

        device_names = ", ".join(d.name for d in triggered_devices[:5])
        if len(triggered_devices) > 5:
            device_names += f" and {len(triggered_devices) - 5} more"

        severity = "critical" if rule.rule_type == "device_offline" else "warning"
        if rule.rule_type == "device_online":
            severity = "info"

        messages = {
            "device_offline": f"Device(s) offline: {device_names}",
            "device_online": f"Device(s) came online: {device_names}",
            "high_latency": f"High latency detected on: {device_names} (threshold: {rule.threshold_value}ms)",
        }
        message = messages.get(rule.rule_type, f"Alert triggered: {device_names}")

        notification_result = send_alert_notification(
            rule_name=rule.name,
            message=message,
            severity=severity,
            notify_email=rule.notify_email,
            notify_slack=rule.notify_slack,
            email_recipients=[r.strip() for r in get_alert_config_value(db, "email_recipients", "").split(",") if r.strip()] or None,
            slack_webhook_url=get_alert_config_value(db, "slack_webhook_url", "") or None,
        )

        for device in triggered_devices[:1]:
            log = AlertLog(
                rule_id=rule.id,
                device_id=device.id,
                message=message,
                severity=severity,
                sent_email=notification_result.get("email_sent", False),
                sent_slack=notification_result.get("slack_sent", False),
            )
            db.add(log)

        if len(triggered_devices) > 1:
            log = AlertLog(
                rule_id=rule.id,
                device_id=None,
                message=message,
                severity=severity,
                sent_email=notification_result.get("email_sent", False),
                sent_slack=notification_result.get("slack_sent", False),
            )
            db.add(log)

    db.commit()


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
                evaluate_alerts(db, list(zip(devices, results)))
            db.close()
        except Exception:
            pass
        await asyncio.sleep(300)



@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(background_ping_loop())
    yield

app = FastAPI(title="Ping Monitor API", version="1.0.0", lifespan=lifespan)

cors_origins = [o.strip() for o in os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
).split(",") if o.strip()]
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Auth Routes ───────────────────────────────────────────────

@app.post("/api/auth/login", response_model=TokenWithPermissions)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    if _is_login_limited(request, form_data.username):
        raise _rate_limit_exception()

    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        _record_failed_login(request, form_data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    _clear_failed_logins(form_data.username)
    access_token = create_access_token(data={"sub": str(user.id)})
    permissions = get_user_permissions(user)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "permissions": permissions,
        "is_admin": user.is_admin,
    }


@app.post("/api/auth/change-password")
def change_password(
    data: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(data.current_password, current_user.hashed_password):
        _record_failed_login(request, current_user.username)
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    _clear_failed_logins(current_user.username)
    return {"detail": "Password changed successfully"}


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
    devices = get_visible_devices(db, current_user).all()
    result = []
    for d in devices:
        result.append(DeviceResponse(
            id=d.id,
            name=d.name,
            ip_address=d.ip_address,
            status=d.status,
            latency=d.latency,
            owner_id=d.owner_id,
            group_id=d.group_id,
            group_name=d.group.name if d.group else None,
            created_at=d.created_at,
            updated_at=d.updated_at,
        ))
    return result


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
        group_id=device.group_id,
    )
    db.add(new_device)
    db.commit()
    db.refresh(new_device)
    return DeviceResponse(
        id=new_device.id,
        name=new_device.name,
        ip_address=new_device.ip_address,
        status=new_device.status,
        latency=new_device.latency,
        owner_id=new_device.owner_id,
        group_id=new_device.group_id,
        group_name=new_device.group.name if new_device.group else None,
        created_at=new_device.created_at,
        updated_at=new_device.updated_at,
    )


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
    if device.group_id is not None:
        db_device.group_id = device.group_id

    db_device.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_device)
    return DeviceResponse(
        id=db_device.id,
        name=db_device.name,
        ip_address=db_device.ip_address,
        status=db_device.status,
        latency=db_device.latency,
        owner_id=db_device.owner_id,
        group_id=db_device.group_id,
        group_name=db_device.group.name if db_device.group else None,
        created_at=db_device.created_at,
        updated_at=db_device.updated_at,
    )


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


@app.post("/api/devices/ping-group/{group_id}", response_model=list[DeviceResponse])
def ping_group_devices(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    devices = db.query(Device).filter(Device.group_id == group_id).all()
    if not devices:
        return []

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
    evaluate_alerts(db, list(zip(devices, results)))
    for device in devices:
        db.refresh(device)
    return devices


# ─── Device Group Routes ─────────────────────────────────────

@app.get("/api/groups", response_model=list[DeviceGroupResponse])
def list_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    groups = db.query(DeviceGroup).all()
    result = []
    for g in groups:
        device_count = db.query(Device).filter(Device.group_id == g.id).count()
        result.append(DeviceGroupResponse(
            id=g.id,
            name=g.name,
            color=g.color,
            device_count=device_count,
            created_at=g.created_at,
        ))
    return result


@app.post("/api/groups", response_model=DeviceGroupResponse)
def create_group(
    group: DeviceGroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("create_devices")),
):
    existing = db.query(DeviceGroup).filter(DeviceGroup.name == group.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Group name already exists")

    new_group = DeviceGroup(name=group.name, color=group.color)
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return DeviceGroupResponse(
        id=new_group.id,
        name=new_group.name,
        color=new_group.color,
        device_count=0,
        created_at=new_group.created_at,
    )


@app.put("/api/groups/{group_id}", response_model=DeviceGroupResponse)
def update_group(
    group_id: int,
    group: DeviceGroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("create_devices")),
):
    db_group = db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group.name is not None:
        existing = db.query(DeviceGroup).filter(
            DeviceGroup.name == group.name,
            DeviceGroup.id != group_id,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Group name already exists")
        db_group.name = group.name

    if group.color is not None:
        db_group.color = group.color

    db.commit()
    db.refresh(db_group)
    device_count = db.query(Device).filter(Device.group_id == group_id).count()
    return DeviceGroupResponse(
        id=db_group.id,
        name=db_group.name,
        color=db_group.color,
        device_count=device_count,
        created_at=db_group.created_at,
    )


@app.delete("/api/groups/{group_id}")
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("create_devices")),
):
    db_group = db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Group not found")

    db.query(Device).filter(Device.group_id == group_id).update({"group_id": None})
    db.delete(db_group)
    db.commit()
    return {"detail": "Group deleted"}


@app.post("/api/groups/{group_id}/assign-devices")
def assign_devices_to_group(
    group_id: int,
    device_ids: list[int],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("create_devices")),
):
    group = db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    db.query(Device).filter(Device.id.in_(device_ids)).update(
        {"group_id": group_id}, synchronize_session=False
    )
    db.commit()
    return {"detail": f"{len(device_ids)} device(s) assigned to group"}


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
    evaluate_alerts(db, list(zip(devices, results)))
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


# ─── Alert Rules ──────────────────────────────────────────────

@app.get("/api/alerts/rules", response_model=list[AlertRuleResponse])
def list_alert_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rules = db.query(AlertRule).order_by(AlertRule.created_at.desc()).all()
    result = []
    for r in rules:
        target_name = None
        if r.target_type == "device" and r.target_id:
            device = db.query(Device).filter(Device.id == r.target_id).first()
            target_name = device.name if device else None
        elif r.target_type == "group" and r.target_id:
            group = db.query(DeviceGroup).filter(DeviceGroup.id == r.target_id).first()
            target_name = group.name if group else None
        result.append(AlertRuleResponse(
            id=r.id,
            name=r.name,
            enabled=r.enabled,
            rule_type=r.rule_type,
            target_type=r.target_type,
            target_id=r.target_id,
            target_name=target_name,
            threshold_value=r.threshold_value,
            cooldown_minutes=r.cooldown_minutes,
            notify_email=r.notify_email,
            notify_slack=r.notify_slack,
            created_at=r.created_at,
            updated_at=r.updated_at,
        ))
    return result


@app.post("/api/alerts/rules", response_model=AlertRuleResponse)
def create_alert_rule(
    rule: AlertRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_users")),
):
    new_rule = AlertRule(
        name=rule.name,
        rule_type=rule.rule_type,
        target_type=rule.target_type,
        target_id=rule.target_id,
        threshold_value=rule.threshold_value,
        cooldown_minutes=rule.cooldown_minutes,
        notify_email=rule.notify_email,
        notify_slack=rule.notify_slack,
        enabled=rule.enabled,
    )
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)

    target_name = None
    if new_rule.target_type == "device" and new_rule.target_id:
        device = db.query(Device).filter(Device.id == new_rule.target_id).first()
        target_name = device.name if device else None
    elif new_rule.target_type == "group" and new_rule.target_id:
        group = db.query(DeviceGroup).filter(DeviceGroup.id == new_rule.target_id).first()
        target_name = group.name if group else None

    return AlertRuleResponse(
        id=new_rule.id,
        name=new_rule.name,
        enabled=new_rule.enabled,
        rule_type=new_rule.rule_type,
        target_type=new_rule.target_type,
        target_id=new_rule.target_id,
        target_name=target_name,
        threshold_value=new_rule.threshold_value,
        cooldown_minutes=new_rule.cooldown_minutes,
        notify_email=new_rule.notify_email,
        notify_slack=new_rule.notify_slack,
        created_at=new_rule.created_at,
        updated_at=new_rule.updated_at,
    )


@app.put("/api/alerts/rules/{rule_id}", response_model=AlertRuleResponse)
def update_alert_rule(
    rule_id: int,
    rule: AlertRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_users")),
):
    db_rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    if rule.name is not None:
        db_rule.name = rule.name
    if rule.rule_type is not None:
        db_rule.rule_type = rule.rule_type
    if rule.target_type is not None:
        db_rule.target_type = rule.target_type
    if rule.target_id is not None:
        db_rule.target_id = rule.target_id
    if rule.threshold_value is not None:
        db_rule.threshold_value = rule.threshold_value
    if rule.cooldown_minutes is not None:
        db_rule.cooldown_minutes = rule.cooldown_minutes
    if rule.notify_email is not None:
        db_rule.notify_email = rule.notify_email
    if rule.notify_slack is not None:
        db_rule.notify_slack = rule.notify_slack
    if rule.enabled is not None:
        db_rule.enabled = rule.enabled

    db_rule.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(db_rule)

    target_name = None
    if db_rule.target_type == "device" and db_rule.target_id:
        device = db.query(Device).filter(Device.id == db_rule.target_id).first()
        target_name = device.name if device else None
    elif db_rule.target_type == "group" and db_rule.target_id:
        group = db.query(DeviceGroup).filter(DeviceGroup.id == db_rule.target_id).first()
        target_name = group.name if group else None

    return AlertRuleResponse(
        id=db_rule.id,
        name=db_rule.name,
        enabled=db_rule.enabled,
        rule_type=db_rule.rule_type,
        target_type=db_rule.target_type,
        target_id=db_rule.target_id,
        target_name=target_name,
        threshold_value=db_rule.threshold_value,
        cooldown_minutes=db_rule.cooldown_minutes,
        notify_email=db_rule.notify_email,
        notify_slack=db_rule.notify_slack,
        created_at=db_rule.created_at,
        updated_at=db_rule.updated_at,
    )


@app.delete("/api/alerts/rules/{rule_id}")
def delete_alert_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_users")),
):
    db_rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    db.delete(db_rule)
    db.commit()
    return {"detail": "Alert rule deleted"}


@app.post("/api/alerts/rules/{rule_id}/toggle")
def toggle_alert_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_users")),
):
    db_rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    db_rule.enabled = not db_rule.enabled
    db_rule.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"enabled": db_rule.enabled}


# ─── Alert Logs ───────────────────────────────────────────────

@app.get("/api/alerts/logs", response_model=list[AlertLogResponse])
def list_alert_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logs = (
        db.query(AlertLog)
        .order_by(AlertLog.created_at.desc())
        .limit(limit)
        .all()
    )
    result = []
    for log in logs:
        device_name = None
        device_ip = None
        if log.device_id:
            device = db.query(Device).filter(Device.id == log.device_id).first()
            if device:
                device_name = device.name
                device_ip = device.ip_address
        rule = db.query(AlertRule).filter(AlertRule.id == log.rule_id).first()
        result.append(AlertLogResponse(
            id=log.id,
            rule_id=log.rule_id,
            rule_name=rule.name if rule else None,
            device_id=log.device_id,
            device_name=device_name,
            device_ip=device_ip,
            message=log.message,
            severity=log.severity,
            sent_email=log.sent_email,
            sent_slack=log.sent_slack,
            created_at=log.created_at,
        ))
    return result


@app.delete("/api/alerts/logs")
def clear_alert_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_users")),
):
    db.query(AlertLog).delete()
    db.commit()
    return {"detail": "Alert logs cleared"}


# ─── Notification Config ──────────────────────────────────────

@app.get("/api/alerts/config", response_model=AlertConfigResponse)
def get_alert_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_users")),
):
    from notifications import get_email_config, get_slack_config
    email_cfg = get_email_config()
    slack_cfg = get_slack_config()

    db_recipients = get_alert_config_value(db, "email_recipients", "")
    db_slack_url = get_alert_config_value(db, "slack_webhook_url", "")

    env_recipients = email_cfg["alert_recipients"]
    env_slack_url = slack_cfg["webhook_url"]

    final_recipients = db_recipients or env_recipients
    final_slack_url = db_slack_url or env_slack_url

    return AlertConfigResponse(
        email_recipients=final_recipients,
        slack_webhook_url=final_slack_url,
        smtp_configured=bool(email_cfg["smtp_host"] and email_cfg["smtp_user"]),
        slack_configured=bool(final_slack_url),
    )


@app.put("/api/alerts/config")
def update_alert_config(
    config: AlertConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_users")),
):
    if config.email_recipients is not None:
        set_alert_config_value(db, "email_recipients", config.email_recipients)
    if config.slack_webhook_url is not None:
        set_alert_config_value(db, "slack_webhook_url", config.slack_webhook_url)
    return {"detail": "Config updated"}


@app.post("/api/alerts/test")
def test_alert_notification(
    req: NotificationTestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("manage_users")),
):
    from notifications import get_slack_config

    if req.channel == "email":
        recipients = [r.strip() for r in get_alert_config_value(db, "email_recipients", "").split(",") if r.strip()]
        if req.email:
            recipients = [req.email]
        if not recipients:
            return {"success": False, "message": "No email recipients configured. Add recipients in Alert Settings."}
        result = test_notification(req.channel, recipients[0])
        return result

    elif req.channel == "slack":
        db_url = get_alert_config_value(db, "slack_webhook_url", "")
        env_url = get_slack_config()["webhook_url"]
        if not db_url and not env_url:
            return {"success": False, "message": "No Slack webhook URL configured. Add it in Alert Settings."}
        result = test_notification(req.channel, req.email, slack_webhook_url=db_url or env_url)
        return result

    return {"success": False, "message": f"Unknown channel: {req.channel}"}


# ─── Serve Frontend ────────────────────────────────────────────

if getattr(sys, "frozen", False):
    FRONTEND_DIR = os.path.join(getattr(sys, "_MEIPASS", "."), "frontend", "dist")
else:
    FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist")

if os.path.isdir(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str, request: Request):
        file_path = os.path.join(FRONTEND_DIR, full_path)
        if os.path.isfile(file_path):
            if full_path.startswith("assets/"):
                request.state.skip_cache = True
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


if __name__ == "__main__":
    import uvicorn
    import webbrowser
    import threading
    import time

    host = os.getenv("HOST", "0.0.0.0")
    preferred_port = int(os.getenv("PORT", "8000"))
    port = preferred_port
    if not os.getenv("PORT"):
        probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            probe.bind(("0.0.0.0", preferred_port))
        except OSError:
            probe.bind(("0.0.0.0", 0))
            port = probe.getsockname()[1]
        probe.close()

    ssl_kwargs = {}
    if os.getenv("SSL_CERTFILE") and os.getenv("SSL_KEYFILE"):
        ssl_kwargs = {
            "ssl_certfile": os.getenv("SSL_CERTFILE"),
            "ssl_keyfile": os.getenv("SSL_KEYFILE"),
        }

    protocol = "https" if ssl_kwargs else "http"

    def _open_browser():
        time.sleep(2.0)
        webbrowser.open(f"{protocol}://localhost:{port}")

    print(f"Ping Monitor running at {protocol}://localhost:{port}")
    threading.Thread(target=_open_browser, daemon=True).start()
    uvicorn.run(app, host=host, port=port, **ssl_kwargs)
