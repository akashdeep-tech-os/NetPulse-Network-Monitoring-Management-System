"""One-time migration: legacy ping_monitor.db -> NetPulse multi-tenant schema.

Creates (or reuses) an organization and imports users, groups, devices,
status history (as ICMP checks + check results), alert rules/logs/config.

Usage (from backend/):
    .venv\\Scripts\\python.exe scripts\\migrate_legacy.py
    .venv\\Scripts\\python.exe scripts\\migrate_legacy.py --legacy-db ping_monitor.db --org-name "My Org" --org-slug my-org
"""
import argparse
import sqlite3
from datetime import datetime
from typing import Optional

from sqlalchemy import select

from core.security import utcnow
from database.session import SessionLocal
from models import (
    AlertConfig,
    AlertLog,
    AlertRule,
    CheckResult,
    Device,
    DeviceCheck,
    DeviceGroup,
    Organization,
    Plan,
    Role,
    Subscription,
    User,
)

ROLE_MAP = {"admin": "org_owner", "user": "viewer", "manager": "network_manager", "operator": "network_operator"}


def _dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def migrate(legacy_db: str, org_name: str, org_slug: str) -> None:
    legacy = sqlite3.connect(legacy_db)
    legacy.row_factory = sqlite3.Row

    db = SessionLocal()
    try:
        org = db.execute(select(Organization).where(Organization.slug == org_slug)).scalar_one_or_none()
        if org is None:
            org = Organization(name=org_name, slug=org_slug, status="active")
            db.add(org)
            db.flush()
            free = db.execute(select(Plan).where(Plan.slug == "free")).scalar_one_or_none()
            if free:
                db.add(Subscription(organization_id=org.id, plan_id=free.id, status="trial"))
        print(f"Organization: {org.name} (id={org.id})")

        role_ids: dict[str, int] = {}
        for legacy_name, new_name in ROLE_MAP.items():
            role = db.execute(select(Role).where(Role.name == new_name)).scalar_one_or_none()
            if role:
                role_ids[legacy_name] = role.id
        if not role_ids:
            raise RuntimeError("Seed roles not found - run the app once (or run_seed) before migrating")

        taken_usernames = {u for (u,) in db.execute(select(User.username)).all()}
        taken_emails = {e for (e,) in db.execute(select(User.email)).all()}
        user_ids: dict[int, int] = {}
        for row in legacy.execute("select * from users order by id"):
            legacy_role = "admin" if row["is_admin"] else "user"
            username = row["username"]
            email = row["email"]
            if username in taken_usernames:
                username = f"{username}.imported"
            if email in taken_emails:
                email = f"{email.split('@')[0]}.imported@{email.split('@')[-1]}"
            taken_usernames.add(username)
            taken_emails.add(email)
            user = User(
                organization_id=org.id,
                username=username,
                email=email,
                hashed_password=row["hashed_password"],
                role_id=role_ids.get(legacy_role),
                is_active=True,
                is_platform_admin=False,
                created_at=_dt(row["created_at"]) or utcnow(),
            )
            db.add(user)
            db.flush()
            user_ids[row["id"]] = user.id
        print(f"Users imported: {len(user_ids)}")

        group_ids: dict[int, int] = {}
        for row in legacy.execute("select * from device_groups order by id"):
            g = DeviceGroup(id=row["id"], organization_id=org.id, name=row["name"],
                            color=row["color"] or "#3B82F6", created_at=_dt(row["created_at"]) or utcnow())
            db.add(g)
            group_ids[row["id"]] = row["id"]
        db.flush()
        print(f"Groups imported: {len(group_ids)}")

        device_ids: dict[int, int] = {}
        check_ids: dict[int, int] = {}
        for row in legacy.execute("select * from devices order by id"):
            dev = Device(
                id=row["id"],
                organization_id=org.id,
                group_id=group_ids.get(row["group_id"]),
                name=row["name"],
                ip_address=row["ip_address"],
                status=row["status"] or "Offline",
                latency=row["latency"],
                created_by=user_ids.get(row["owner_id"]),
                monitoring_enabled=True,
                created_at=_dt(row["created_at"]) or utcnow(),
                updated_at=_dt(row["updated_at"]) or utcnow(),
            )
            db.add(dev)
            chk = DeviceCheck(
                organization_id=org.id,
                device_id=row["id"],
                name=f"{row['name']} (imported)",
                check_type="icmp",
                host=row["ip_address"],
                timeout_seconds=5,
                enabled=True,
                status=row["status"] or "Offline",
                latency=row["latency"],
                created_at=_dt(row["created_at"]) or utcnow(),
                updated_at=_dt(row["updated_at"]) or utcnow(),
            )
            db.add(chk)
            db.flush()
            device_ids[row["id"]] = row["id"]
            check_ids[row["id"]] = chk.id
        db.flush()
        print(f"Devices imported: {len(device_ids)}")

        count = 0
        batch: list[CheckResult] = []
        for row in legacy.execute("select * from device_status_history order by checked_at"):
            if row["device_id"] not in device_ids:
                continue
            batch.append(CheckResult(
                organization_id=org.id,
                device_id=device_ids[row["device_id"]],
                check_id=check_ids[row["device_id"]],
                check_type="icmp",
                timestamp=_dt(row["checked_at"]) or utcnow(),
                status=row["status"] or "Offline",
                latency=row["latency"],
            ))
            if len(batch) >= 500:
                db.add_all(batch)
                batch.clear()
                count += 500
        if batch:
            db.add_all(batch)
            count += len(batch)
        db.flush()
        print(f"History rows imported: {count}")

        rule_ids: dict[int, int] = {}
        for row in legacy.execute("select * from alert_rules order by id"):
            channels = []
            if row["notify_email"]:
                channels.append("email")
            if row["notify_slack"]:
                channels.append("slack")
            if not channels:
                channels = ["in_app"]
            rule = AlertRule(
                id=row["id"],
                organization_id=org.id,
                name=row["name"],
                enabled=bool(row["enabled"]),
                rule_type=row["rule_type"],
                target_type=row["target_type"],
                target_id=row["target_id"],
                threshold_value=row["threshold_value"],
                severity="warning",
                cooldown_minutes=row["cooldown_minutes"] or 5,
                channels=channels,
                created_at=_dt(row["created_at"]) or utcnow(),
                updated_at=_dt(row["updated_at"]) or utcnow(),
            )
            db.add(rule)
            rule_ids[row["id"]] = row["id"]
        db.flush()
        print(f"Alert rules imported: {len(rule_ids)}")

        log_count = 0
        batch_logs: list[AlertLog] = []
        fallback_rule_id = next(iter(rule_ids.values()), None)
        for row in legacy.execute("select * from alert_logs order by created_at"):
            sent = []
            if row["sent_email"]:
                sent.append("email")
            if row["sent_slack"]:
                sent.append("slack")
            rule_id = rule_ids.get(row["rule_id"], fallback_rule_id)
            if rule_id is None:
                continue
            batch_logs.append(AlertLog(
                organization_id=org.id,
                rule_id=rule_id,
                device_id=device_ids.get(row["device_id"]),
                message=row["message"],
                severity=row["severity"] or "warning",
                status="open",
                sent_channels=sent,
                created_at=_dt(row["created_at"]) or utcnow(),
            ))
            if len(batch_logs) >= 500:
                db.add_all(batch_logs)
                batch_logs.clear()
                log_count += 500
        if batch_logs:
            db.add_all(batch_logs)
            log_count += len(batch_logs)
        db.flush()
        print(f"Alert logs imported: {log_count}")

        cfg_count = 0
        for row in legacy.execute("select * from alert_config"):
            db.add(AlertConfig(organization_id=org.id, key=row["key"], value=row["value"],
                               updated_at=_dt(row["updated_at"]) or utcnow()))
            cfg_count += 1
        db.flush()
        print(f"Alert config keys imported: {cfg_count}")

        db.commit()
        print("MIGRATION COMPLETE")
    finally:
        db.close()
        legacy.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate legacy ping_monitor.db into NetPulse")
    parser.add_argument("--legacy-db", default="ping_monitor.db", help="Path to legacy SQLite database")
    parser.add_argument("--org-name", default="Imported Network", help="Organization name to create/reuse")
    parser.add_argument("--org-slug", default="imported-network", help="Organization slug (unique)")
    args = parser.parse_args()
    migrate(args.legacy_db, args.org_name, args.org_slug)
