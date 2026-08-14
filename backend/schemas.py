from pydantic import BaseModel, field_serializer, Field
from datetime import datetime, timezone
from typing import Optional


# Auth Schemas
class PermissionResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class RoleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    permissions: list[PermissionResponse] = []

    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_admin: bool
    role_id: Optional[int] = None
    role_name: Optional[str] = None
    permissions: list[str] = []
    created_at: datetime

    class Config:
        from_attributes = True


class AdminUserCreate(BaseModel):
    username: str
    email: str
    password: str = Field(min_length=8, description="Password must be at least 8 characters")
    role_id: Optional[int] = None


class UserRoleUpdate(BaseModel):
    role_id: int


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, description="Password must be at least 8 characters")


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenWithPermissions(BaseModel):
    access_token: str
    token_type: str
    permissions: list[str]
    is_admin: bool


# Device Schemas
class DeviceCreate(BaseModel):
    name: str
    ip_address: str
    group_id: Optional[int] = None


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    ip_address: Optional[str] = None
    status: Optional[str] = None
    group_id: Optional[int] = None


class DeviceResponse(BaseModel):
    id: int
    name: str
    ip_address: str
    status: str
    latency: Optional[float] = None
    owner_id: int
    group_id: Optional[int] = None
    group_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @field_serializer("created_at", "updated_at")
    def serialize_utc(self, dt: datetime, _info):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


# Device Group Schemas
class DeviceGroupCreate(BaseModel):
    name: str
    color: Optional[str] = "#3B82F6"


class DeviceGroupUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class DeviceGroupResponse(BaseModel):
    id: int
    name: str
    color: str
    device_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

    @field_serializer("created_at")
    def serialize_utc(self, dt: datetime, _info):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


class DeviceImport(BaseModel):
    devices: list[DeviceCreate]


class PortScanRequest(BaseModel):
    target_ip: str
    start_port: int = 1
    end_port: int = 5000
    threads: int = 200


class PortResult(BaseModel):
    port: int
    service: str
    banner: str


class PortScanResponse(BaseModel):
    target_ip: str
    open_ports: list[PortResult]
    total_scanned: int
    scan_time: str


# Alert Schemas
class AlertRuleCreate(BaseModel):
    name: str
    rule_type: str
    target_type: str = "all"
    target_id: Optional[int] = None
    threshold_value: Optional[float] = None
    cooldown_minutes: int = 5
    notify_email: bool = False
    notify_slack: bool = False
    enabled: bool = True


class AlertRuleUpdate(BaseModel):
    name: Optional[str] = None
    rule_type: Optional[str] = None
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    threshold_value: Optional[float] = None
    cooldown_minutes: Optional[int] = None
    notify_email: Optional[bool] = None
    notify_slack: Optional[bool] = None
    enabled: Optional[bool] = None


class AlertRuleResponse(BaseModel):
    id: int
    name: str
    enabled: bool
    rule_type: str
    target_type: str
    target_id: Optional[int] = None
    target_name: Optional[str] = None
    threshold_value: Optional[float] = None
    cooldown_minutes: int
    notify_email: bool
    notify_slack: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @field_serializer("created_at", "updated_at")
    def serialize_utc(self, dt: datetime, _info):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


class AlertLogResponse(BaseModel):
    id: int
    rule_id: int
    rule_name: Optional[str] = None
    device_id: Optional[int] = None
    device_name: Optional[str] = None
    device_ip: Optional[str] = None
    message: str
    severity: str
    sent_email: bool
    sent_slack: bool
    created_at: datetime

    class Config:
        from_attributes = True

    @field_serializer("created_at")
    def serialize_utc(self, dt: datetime, _info):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


class NotificationTestRequest(BaseModel):
    channel: str
    email: Optional[str] = None


class AlertConfigUpdate(BaseModel):
    email_recipients: Optional[str] = None
    slack_webhook_url: Optional[str] = None


class AlertConfigResponse(BaseModel):
    email_recipients: str
    slack_webhook_url: str
    smtp_configured: bool
    slack_configured: bool
