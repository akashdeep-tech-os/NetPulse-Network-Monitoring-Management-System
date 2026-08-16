"""Database seeding: roles, permissions, plans, platform admin, demo organization."""
import logging

from sqlalchemy.orm import Session

from core.config import settings
from core.permissions import ORG_PERMISSIONS, PLATFORM_PERMISSIONS, ROLES
from core.security import hash_password, utcnow
from database.session import SessionLocal
from models import (
    Organization,
    Permission,
    Plan,
    Role,
    role_permissions,
    Subscription,
    User,
)

logger = logging.getLogger(__name__)


def _seed_permissions(db: Session) -> None:
    for perm in ORG_PERMISSIONS + PLATFORM_PERMISSIONS:
        if db.query(Permission).filter(Permission.name == perm).first() is None:
            db.add(Permission(name=perm))


def _seed_roles(db: Session) -> None:
    for name, spec in ROLES.items():
        role = db.query(Role).filter(Role.name == name).first()
        if role is None:
            role = Role(name=name, description=spec["description"], scope=spec["scope"])
            db.add(role)
            db.flush()
        perms = set(spec["permissions"])
        if name == "platform_admin":
            perms |= set(PLATFORM_PERMISSIONS)
        current = {p.name for p in role.permissions}
        missing = perms - current
        if missing:
            perm_rows = db.query(Permission).filter(Permission.name.in_(missing)).all()
            role.permissions.extend(perm_rows)


def _seed_plans(db: Session) -> None:
    plans = [
        {
            "name": "Free", "slug": "free", "description": "Personal projects", "price": 0,
            "max_users": 1, "max_devices": 5, "max_groups": 3, "max_api_keys": 1,
            "monitoring_interval": 60, "ai_features_enabled": True, "advanced_reports_enabled": False,
            "max_retention_days": 7, "ai_requests_per_month": 50,
        },
        {
            "name": "Starter", "slug": "starter", "description": "Small teams", "price": 19,
            "max_users": 5, "max_devices": 50, "max_groups": 10, "max_api_keys": 3,
            "monitoring_interval": 30, "ai_features_enabled": True, "advanced_reports_enabled": True,
            "max_retention_days": 30, "ai_requests_per_month": 500,
        },
        {
            "name": "Professional", "slug": "professional", "description": "Growing companies", "price": 49,
            "max_users": 20, "max_devices": 250, "max_groups": 50, "max_api_keys": 10,
            "monitoring_interval": 15, "ai_features_enabled": True, "advanced_reports_enabled": True,
            "max_retention_days": 90, "ai_requests_per_month": 5000,
        },
        {
            "name": "Enterprise", "slug": "enterprise", "description": "Large organizations", "price": 199,
            "max_users": 100, "max_devices": 5000, "max_groups": 500, "max_api_keys": 50,
            "monitoring_interval": 5, "ai_features_enabled": True, "advanced_reports_enabled": True,
            "max_retention_days": 365, "ai_requests_per_month": 50000,
        },
    ]
    for data in plans:
        if db.query(Plan).filter(Plan.slug == data["slug"]).first() is None:
            db.add(Plan(**data))


def _seed_platform_admin(db: Session) -> None:
    username = getattr(settings, "ADMIN_USERNAME", None) or "admin"
    if db.query(User).filter(User.username == username).first():
        return
    admin_role = db.query(Role).filter(Role.name == "platform_admin").first()
    password = getattr(settings, "ADMIN_PASSWORD", None)
    if not password:
        import secrets
        import string

        alphabet = string.ascii_letters + string.digits
        password = "".join(secrets.choice(alphabet) for _ in range(16))
        try:
            with open(settings.DATA_DIR / "admin_credentials.txt", "w") as f:
                f.write(f"Username: {username}\nPassword: {password}\n")
        except OSError as e:
            logger.warning(f"Could not persist admin credentials: {e}")
        logger.warning("Platform admin password generated; see backend/data/admin_credentials.txt")
    user = User(
        username=username,
        email=getattr(settings, "ADMIN_EMAIL", None) or f"{username}@netpulse.local",
        hashed_password=hash_password(password),
        is_platform_admin=True,
        is_active=True,
        is_email_verified=True,
        role_id=admin_role.id if admin_role else None,
    )
    db.add(user)
    logger.info("Platform admin '%s' created", username)


def _seed_demo_organization(db: Session) -> None:
    """Creates the default organization + owner for out-of-the-box usage."""
    slug = "demo"
    org = db.query(Organization).filter(Organization.slug == slug).first()
    if org is None:
        org = Organization(name="Demo Organization", slug=slug, status="active")
        db.add(org)
        db.flush()
        plan = db.query(Plan).filter(Plan.slug == "starter").first()
        if plan:
            db.add(Subscription(
                organization_id=org.id,
                plan_id=plan.id,
                status="trial",
                billing_cycle="monthly",
                started_at=utcnow(),
            ))
    owner_role = db.query(Role).filter(Role.name == "org_owner").first()
    if db.query(User).filter(User.username == "demo", User.organization_id == org.id).first() is None:
        db.add(User(
            organization_id=org.id,
            username="demo",
            email="demo@netpulse.local",
            hashed_password=hash_password("Demo@1234"),
            full_name="Demo User",
            role_id=owner_role.id if owner_role else None,
            is_active=True,
            is_email_verified=True,
        ))
        logger.info("Demo organization + demo user created (demo / Demo@1234)")


def _seed_role_users(db: Session) -> None:
    """Seeds one user per role: super admin, org admin, regular user, viewer."""
    org = db.query(Organization).filter(Organization.slug == "demo").first()
    if org is None:
        logger.warning("Demo organization missing; skipping role users seed")
        return
    users = [
        {
            "username": "superadmin",
            "email": "superadmin@netpulse.local",
            "password": "Super@1234",
            "full_name": "Super Admin",
            "role": "platform_admin",
            "is_platform_admin": True,
        },
        {
            "username": "orgadmin",
            "email": "orgadmin@netpulse.local",
            "password": "Admin@1234",
            "full_name": "Organization Admin",
            "role": "org_admin",
            "is_platform_admin": False,
        },
        {
            "username": "user",
            "email": "user@netpulse.local",
            "password": "User@1234",
            "full_name": "Regular User",
            "role": "network_operator",
            "is_platform_admin": False,
        },
        {
            "username": "viewer",
            "email": "viewer@netpulse.local",
            "password": "Viewer@1234",
            "full_name": "Viewer",
            "role": "viewer",
            "is_platform_admin": False,
        },
    ]
    for data in users:
        if db.query(User).filter(User.username == data["username"]).first() is not None:
            continue
        role = db.query(Role).filter(Role.name == data["role"]).first()
        db.add(User(
            organization_id=org.id,
            username=data["username"],
            email=data["email"],
            hashed_password=hash_password(data["password"]),
            full_name=data["full_name"],
            role_id=role.id if role else None,
            is_platform_admin=data["is_platform_admin"],
            is_active=True,
            is_email_verified=True,
        ))
        logger.info("Role user '%s' created (%s)", data["username"], data["role"])


def run_seed() -> None:
    db = SessionLocal()
    try:
        _seed_permissions(db)
        _seed_roles(db)
        _seed_plans(db)
        _seed_platform_admin(db)
        _seed_demo_organization(db)
        _seed_role_users(db)
        db.commit()
        logger.info("Database seeded")
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_seed()
