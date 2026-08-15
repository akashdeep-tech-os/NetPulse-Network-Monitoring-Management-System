"""API v1 router aggregation."""
from fastapi import APIRouter

from api.v1 import (
    ai,
    alerts,
    analytics,
    api_keys,
    audit,
    auth,
    billing,
    devices,
    monitoring,
    organizations,
    platform,
    reports,
    system,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(organizations.router)
api_router.include_router(devices.router)
api_router.include_router(monitoring.router)
api_router.include_router(alerts.router)
api_router.include_router(analytics.router)
api_router.include_router(ai.router)
api_router.include_router(reports.router)
api_router.include_router(billing.router)
api_router.include_router(api_keys.router)
api_router.include_router(audit.router)
api_router.include_router(platform.router)
api_router.include_router(system.router)
