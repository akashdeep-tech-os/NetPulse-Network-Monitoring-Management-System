"""Pydantic schemas for the NetPulse API."""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

model_config = ConfigDict(from_attributes=True)


class Message(BaseModel):
    message: str


# ─── Auth ──────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class LoginResponse(Token):
    user: "UserOut"
    organization_name: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class VerifyEmailRequest(BaseModel):
    token: str


class UserOut(BaseModel):
    id: int
    organization_id: Optional[int] = None
    username: str
    email: str
    full_name: Optional[str] = None
    role_id: Optional[int] = None
    role_name: Optional[str] = None
    permissions: list[str] = []
    is_platform_admin: bool = False
    is_active: bool = True
    is_email_verified: bool = False
    last_login_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: Optional[str] = None
    role_id: Optional[int] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    role_id: Optional[int] = None


class SessionOut(BaseModel):
    id: int
    device_name: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime
    expires_at: datetime
    revoked_at: Optional[datetime] = None
    is_current: bool = False

    model_config = ConfigDict(from_attributes=True)


class RoleOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    scope: str = "organization"
    is_system: bool = True
    permissions: list[str] = []

    model_config = ConfigDict(from_attributes=True)


# ─── Organization / Billing ────────────────────────────────────
class PlanOut(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    price: float
    billing_cycle: str
    max_users: int
    max_devices: int
    max_groups: int
    max_api_keys: int
    monitoring_interval: int
    ai_features_enabled: bool
    advanced_reports_enabled: bool
    max_retention_days: int
    ai_requests_per_month: int

    model_config = ConfigDict(from_attributes=True)


class PlanCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    price: float = 0
    billing_cycle: str = "monthly"
    max_users: int = 1
    max_devices: int = 5
    max_groups: int = 5
    max_api_keys: int = 1
    monitoring_interval: int = 60
    ai_features_enabled: bool = True
    advanced_reports_enabled: bool = True
    max_retention_days: int = 90
    ai_requests_per_month: int = 100
    is_active: bool = True


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    max_users: Optional[int] = None
    max_devices: Optional[int] = None
    max_groups: Optional[int] = None
    max_api_keys: Optional[int] = None
    monitoring_interval: Optional[int] = None
    ai_features_enabled: Optional[bool] = None
    advanced_reports_enabled: Optional[bool] = None
    max_retention_days: Optional[int] = None
    ai_requests_per_month: Optional[int] = None
    is_active: Optional[bool] = None


class OrganizationOut(BaseModel):
    id: int
    name: str
    slug: str
    email: Optional[str] = None
    phone: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    timezone: str = "UTC"
    status: str
    plan: Optional[PlanOut] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None


class OrganizationCreate(BaseModel):
    name: str
    slug: str = Field(pattern=r"^[a-z0-9-]+$")
    email: Optional[EmailStr] = None
    plan_slug: str = "free"


class SubscriptionOut(BaseModel):
    id: int
    organization_id: int
    plan_id: int
    plan: Optional[PlanOut] = None
    status: str
    billing_cycle: str
    started_at: datetime
    expires_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SubscribeRequest(BaseModel):
    plan_slug: str
    billing_cycle: str = "monthly"


class UsageOut(BaseModel):
    resource: str
    used: int
    limit: int
    percent: float


# ─── Devices / Groups / Checks ─────────────────────────────────
class DeviceCreate(BaseModel):
    name: str
    ip_address: str
    hostname: Optional[str] = None
    device_type: str = "Server"
    description: Optional[str] = None
    location: Optional[str] = None
    group_id: Optional[int] = None
    monitoring_enabled: bool = True
    monitoring_interval: Optional[int] = None


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    ip_address: Optional[str] = None
    hostname: Optional[str] = None
    device_type: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    group_id: Optional[int] = None
    monitoring_enabled: Optional[bool] = None
    monitoring_interval: Optional[int] = None


class DeviceOut(BaseModel):
    id: int
    organization_id: int
    group_id: Optional[int] = None
    group_name: Optional[str] = None
    name: str
    hostname: Optional[str] = None
    ip_address: str
    device_type: str
    description: Optional[str] = None
    location: Optional[str] = None
    status: str
    monitoring_enabled: bool
    monitoring_interval: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DeviceImportItem(BaseModel):
    name: str
    ip_address: str


class DeviceImportRequest(BaseModel):
    devices: list[DeviceImportItem]


class DeviceGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#3B82F6"


class DeviceGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class DeviceGroupOut(BaseModel):
    id: int
    organization_id: int
    name: str
    description: Optional[str] = None
    color: str
    device_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CheckCreate(BaseModel):
    name: str
    check_type: str  # icmp | tcp | http | dns
    host: Optional[str] = None
    port: Optional[int] = None
    url: Optional[str] = None
    expected_status_code: Optional[int] = None
    timeout_seconds: int = 5
    enabled: bool = True


class CheckUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    url: Optional[str] = None
    expected_status_code: Optional[int] = None
    timeout_seconds: Optional[int] = None
    enabled: Optional[bool] = None


class CheckOut(BaseModel):
    id: int
    organization_id: int
    device_id: int
    device_name: Optional[str] = None
    name: str
    check_type: str
    host: Optional[str] = None
    port: Optional[int] = None
    url: Optional[str] = None
    expected_status_code: Optional[int] = None
    timeout_seconds: int
    enabled: bool
    status: str
    latency: Optional[float] = None
    error: Optional[str] = None
    consecutive_failures: int
    last_checked_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CheckResultOut(BaseModel):
    id: int
    device_id: int
    check_id: Optional[int] = None
    check_type: str
    timestamp: datetime
    status: str
    latency: Optional[float] = None
    packet_loss: Optional[float] = None
    response_code: Optional[int] = None
    error_message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


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


# ─── Alerts ────────────────────────────────────────────────────
class AlertRuleCreate(BaseModel):
    name: str
    rule_type: str
    target_type: str = "all"
    target_id: Optional[int] = None
    threshold_value: Optional[float] = None
    severity: str = "warning"
    cooldown_minutes: int = 5
    channels: list[str] = ["in_app"]
    enabled: bool = True


class AlertRuleUpdate(BaseModel):
    name: Optional[str] = None
    rule_type: Optional[str] = None
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    threshold_value: Optional[float] = None
    severity: Optional[str] = None
    cooldown_minutes: Optional[int] = None
    channels: Optional[list[str]] = None
    enabled: Optional[bool] = None


class AlertRuleOut(BaseModel):
    id: int
    organization_id: int
    name: str
    enabled: bool
    rule_type: str
    target_type: str
    target_id: Optional[int] = None
    target_name: Optional[str] = None
    threshold_value: Optional[float] = None
    severity: str
    cooldown_minutes: int
    channels: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertLogOut(BaseModel):
    id: int
    rule_id: int
    rule_name: Optional[str] = None
    device_id: Optional[int] = None
    device_name: Optional[str] = None
    device_ip: Optional[str] = None
    message: str
    severity: str
    status: str
    sent_channels: list[str]
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertActionRequest(BaseModel):
    action: str  # acknowledge | resolve


class NotifConfigOut(BaseModel):
    email_recipients: str
    slack_webhook_url: str
    teams_webhook_url: str
    webhook_url: str
    smtp_configured: bool
    slack_configured: bool
    teams_configured: bool
    webhook_configured: bool


class NotifConfigUpdate(BaseModel):
    email_recipients: Optional[str] = None
    slack_webhook_url: Optional[str] = None
    teams_webhook_url: Optional[str] = None
    webhook_url: Optional[str] = None


class NotificationTestRequest(BaseModel):
    channel: str  # email | slack | teams | webhook
    email: Optional[EmailStr] = None


class InAppNotificationOut(BaseModel):
    id: int
    title: str
    message: str
    severity: str
    alert_id: Optional[int] = None
    read_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Analytics ─────────────────────────────────────────────────
class Kpis(BaseModel):
    total_devices: int = 0
    online_devices: int = 0
    offline_devices: int = 0
    warning_devices: int = 0
    avg_latency: Optional[float] = None
    packet_loss: Optional[float] = None
    overall_uptime: float = 0
    active_alerts: int = 0
    critical_alerts: int = 0
    health_score: Optional[int] = None


class HealthScore(BaseModel):
    score: int
    grade: str
    availability: float
    latency: float
    packet_loss: float
    stability: float
    change_vs_last_week: float


class TimeSeriesPoint(BaseModel):
    timestamp: str
    value: Optional[float] = None


class ChartData(BaseModel):
    availability_hourly: list[dict[str, Any]] = []
    availability_daily: list[dict[str, Any]] = []
    latency_series: list[dict[str, Any]] = []
    latency_summary: dict[str, Any] = {}
    packet_loss_series: list[dict[str, Any]] = []
    downtime: dict[str, Any] = {}
    device_distribution: dict[str, Any] = {}
    top_problem_devices: list[dict[str, Any]] = []


class DashboardOut(BaseModel):
    kpis: Kpis
    health_score: HealthScore
    charts: ChartData
    ai_summary: dict[str, Any] = {}
    ai_insights: list[dict[str, Any]] = []
    ai_recommendations: list[dict[str, Any]] = []
    predictions: list[dict[str, Any]] = []


# ─── AI ────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    reply: str
    tool_name: Optional[str] = None
    evidence: Optional[list[dict[str, Any]]] = None
    confidence: Optional[int] = None


class InsightOut(BaseModel):
    id: int
    insight_type: str
    title: str
    content: str
    severity: str
    confidence: Optional[int] = None
    evidence: Optional[list[dict[str, Any]]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    tool_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── API Keys ──────────────────────────────────────────────────
class ApiKeyCreate(BaseModel):
    name: str
    scopes: list[str] = Field(default_factory=list)
    expires_at: Optional[datetime] = None


class ApiKeyOut(BaseModel):
    id: int
    name: str
    key_prefix: str
    scopes: list[str]
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApiKeyCreated(ApiKeyOut):
    plain_key: str


# ─── Audit ─────────────────────────────────────────────────────
class AuditLogOut(BaseModel):
    id: int
    user_name: Optional[str] = None
    action: str
    resource: str
    resource_id: Optional[str] = None
    ip_address: Optional[str] = None
    details: Optional[dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Reports ───────────────────────────────────────────────────
class ReportRequest(BaseModel):
    report_type: str  # health | uptime | downtime | latency | packet_loss | alerts | groups | ai_summary
    start: datetime
    end: datetime
    format: str = "csv"  # csv | xlsx | pdf
    group_id: Optional[int] = None
    device_id: Optional[int] = None


class Paginated(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[Any]


# ─── Platform ──────────────────────────────────────────────────
class PlatformStats(BaseModel):
    total_organizations: int
    active_organizations: int
    trial_organizations: int
    total_users: int
    total_devices: int
    total_checks: int
    total_check_results: int
    active_alerts: int
    system_uptime_seconds: float
    ai_requests_total: int
    subscription_revenue: float
    plan_distribution: dict[str, int]


class SettingUpdate(BaseModel):
    key: str
    value: str
