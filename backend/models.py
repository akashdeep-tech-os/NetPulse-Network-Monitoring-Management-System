from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Float, Table
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True),
)


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)

    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")
    users = relationship("User", back_populates="role")


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)

    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    devices = relationship("Device", back_populates="owner")
    role = relationship("Role", back_populates="users")


class DeviceGroup(Base):
    __tablename__ = "device_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    color = Column(String, default="#3B82F6")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    devices = relationship("Device", back_populates="group")


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    ip_address = Column(String, nullable=False)
    status = Column(String, default="Offline")
    latency = Column(Float, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    group_id = Column(Integer, ForeignKey("device_groups.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="devices")
    group = relationship("DeviceGroup", back_populates="devices")
    status_history = relationship("DeviceStatusHistory", back_populates="device", cascade="all, delete-orphan")


class DeviceStatusHistory(Base):
    __tablename__ = "device_status_history"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    status = Column(String, nullable=False)
    latency = Column(Float, nullable=True)
    checked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    device = relationship("Device", back_populates="status_history")


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    enabled = Column(Boolean, default=True)
    rule_type = Column(String, nullable=False)
    target_type = Column(String, nullable=False, default="all")
    target_id = Column(Integer, nullable=True)
    threshold_value = Column(Float, nullable=True)
    cooldown_minutes = Column(Integer, default=5)
    notify_email = Column(Boolean, default=False)
    notify_slack = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    logs = relationship("AlertLog", back_populates="rule", cascade="all, delete-orphan")


class AlertLog(Base):
    __tablename__ = "alert_logs"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("alert_rules.id"), nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True)
    message = Column(String, nullable=False)
    severity = Column(String, default="warning")
    sent_email = Column(Boolean, default=False)
    sent_slack = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    rule = relationship("AlertRule", back_populates="logs")
    device = relationship("Device")


class AlertConfig(Base):
    __tablename__ = "alert_config"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(String, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
