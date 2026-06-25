from pydantic import BaseModel, field_serializer
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
    password: str
    role_id: Optional[int] = None


class UserRoleUpdate(BaseModel):
    role_id: int


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


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    ip_address: Optional[str] = None
    status: Optional[str] = None


class DeviceResponse(BaseModel):
    id: int
    name: str
    ip_address: str
    status: str
    latency: Optional[float] = None
    owner_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @field_serializer("created_at", "updated_at")
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
