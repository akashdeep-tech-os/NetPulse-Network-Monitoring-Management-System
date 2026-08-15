"""Network models: devices, groups, checks, check results, alerts."""
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from core.security import utcnow
from database.base import Base


# ─── Device Groups ─────────────────────────────────────────────
class DeviceGroup(Base):
    __tablename__ = "device_groups"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    color = Column(String, default="#3B82F6")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    devices = relationship("Device", back_populates="group")

    __table_args__ = (
        Index("ix_device_groups_org_name", "organization_id", "name"),
    )


# ─── Devices ───────────────────────────────────────────────────
class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    group_id = Column(Integer, ForeignKey("device_groups.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    hostname = Column(String, nullable=True)
    ip_address = Column(String, nullable=False)
    device_type = Column(String, default="Server")
    description = Column(String, nullable=True)
    location = Column(String, nullable=True)
    status = Column(String, default="Offline")
    latency = Column(Float, nullable=True)
    monitoring_enabled = Column(Boolean, default=True)
    monitoring_interval = Column(Integer, nullable=True)
    created_by = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    group = relationship("DeviceGroup", back_populates="devices")
    checks = relationship("DeviceCheck", back_populates="device", cascade="all, delete-orphan")

    @property
    def group_name(self) -> Optional[str]:
        return self.group.name if self.group else None

    __table_args__ = (
        Index("ix_devices_org_status", "organization_id", "status"),
        Index("ix_devices_org_group", "organization_id", "group_id"),
    )


# ─── Monitoring Checks ─────────────────────────────────────────
class DeviceCheck(Base):
    __tablename__ = "device_checks"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    check_type = Column(String, nullable=False)  # icmp | tcp | http | dns
    host = Column(String, nullable=True)
    port = Column(Integer, nullable=True)
    url = Column(String, nullable=True)
    expected_status_code = Column(Integer, nullable=True)
    timeout_seconds = Column(Integer, default=5)
    enabled = Column(Boolean, default=True)
    status = Column(String, default="Offline")
    latency = Column(Float, nullable=True)
    error = Column(String, nullable=True)
    consecutive_failures = Column(Integer, default=0)
    last_checked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    device = relationship("Device", back_populates="checks")
    results = relationship("CheckResult", back_populates="check", cascade="all, delete-orphan")

    @property
    def device_name(self) -> Optional[str]:
        return self.device.name if self.device else None

    __table_args__ = (
        Index("ix_device_checks_org_device", "organization_id", "device_id"),
    )


class CheckResult(Base):
    __tablename__ = "check_results"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)
    check_id = Column(Integer, ForeignKey("device_checks.id"), nullable=True, index=True)
    check_type = Column(String, nullable=False)
    timestamp = Column(DateTime, default=utcnow, nullable=False, index=True)
    status = Column(String, nullable=False)  # Online | Offline
    latency = Column(Float, nullable=True)
    packet_loss = Column(Float, nullable=True)
    response_code = Column(Integer, nullable=True)
    error_message = Column(String, nullable=True)
    details = Column(JSON, nullable=True)

    check = relationship("DeviceCheck", back_populates="results")

    __table_args__ = (
        Index("ix_check_results_org_ts", "organization_id", "timestamp"),
        Index("ix_check_results_device_ts", "device_id", "timestamp"),
        Index("ix_check_results_check_ts", "check_id", "timestamp"),
        Index("ix_check_results_org_status_ts", "organization_id", "status", "timestamp"),
    )


# ─── Alerts ────────────────────────────────────────────────────
class AlertRule(Base):
    __tablename__ = "alert_rules"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    enabled = Column(Boolean, default=True)
    rule_type = Column(String, nullable=False)
    # device_offline | device_online | high_latency | packet_loss |
    # port_down | http_failure | ssl_expiry | repeated_failure | ai_anomaly | predictive_risk
    target_type = Column(String, default="all")  # all | group | device
    target_id = Column(Integer, nullable=True)
    threshold_value = Column(Float, nullable=True)
    severity = Column(String, default="warning")  # info | warning | critical
    cooldown_minutes = Column(Integer, default=5)
    channels = Column(JSON, default=list)  # ["email","slack","teams","webhook","in_app"]
    escalation_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    logs = relationship("AlertLog", back_populates="rule", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_alert_rules_org", "organization_id"),
    )


class AlertLog(Base):
    __tablename__ = "alert_logs"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    rule_id = Column(Integer, ForeignKey("alert_rules.id"), nullable=False, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True, index=True)
    message = Column(String, nullable=False)
    severity = Column(String, default="warning")
    status = Column(String, default="open")  # open | acknowledged | resolved
    acknowledged_by = Column(Integer, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_by = Column(Integer, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    sent_channels = Column(JSON, default=list)
    created_at = Column(DateTime, default=utcnow, index=True)

    rule = relationship("AlertRule", back_populates="logs")

    @property
    def rule_name(self) -> Optional[str]:
        return self.rule.name if self.rule else None
    device = relationship("Device")

    __table_args__ = (
        Index("ix_alert_logs_org_status", "organization_id", "status"),
        Index("ix_alert_logs_org_severity", "organization_id", "severity"),
        Index("ix_alert_logs_org_ts", "organization_id", "created_at"),
    )


class AlertConfig(Base):
    """Per-organization notification configuration (key-value)."""

    __tablename__ = "alert_config"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    key = Column(String, nullable=False)
    value = Column(String, nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        Index("ix_alert_config_org_key", "organization_id", "key", unique=True),
    )


class InAppNotification(Base):
    __tablename__ = "in_app_notifications"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    alert_id = Column(Integer, ForeignKey("alert_logs.id"), nullable=True)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    severity = Column(String, default="info")
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, index=True)
