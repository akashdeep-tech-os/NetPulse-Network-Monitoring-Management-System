"""NetPulse — FastAPI application entrypoint.

Starts the API, seeds the database, and launches the background monitoring
scheduler (monitoring loop, housekeeping loop, AI insight loop).
"""
import logging
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.v1.router import api_router
from core.config import settings
from database.base import Base
from database.seed import run_seed
from database.session import engine

logger = logging.getLogger("netpulse")
logging.basicConfig(level=logging.INFO if settings.DEBUG else logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables (SQLite dev mode; production uses Alembic migrations)
    Base.metadata.create_all(bind=engine)
    run_seed()

    from monitoring.scheduler import ai_insight_loop, housekeeping_loop, monitoring_loop

    tasks = [
        asyncio.create_task(monitoring_loop(), name="monitoring_loop"),
        asyncio.create_task(housekeeping_loop(), name="housekeeping_loop"),
        asyncio.create_task(ai_insight_loop(), name="ai_insight_loop"),
    ]
    logger.info("NetPulse started (monitoring workers=%s)", settings.MONITORING_WORKERS)
    yield
    for task in tasks:
        task.cancel()
    for task in tasks:
        try:
            await task
        except asyncio.CancelledError:
            pass
    logger.info("NetPulse stopped")


app = FastAPI(
    title="NetPulse API",
    version=settings.APP_VERSION,
    description="Multi-tenant network monitoring, analytics and AI platform.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"name": settings.APP_NAME, "version": settings.APP_VERSION, "docs": "/docs"}


app.include_router(api_router)


# Serve the built frontend (production)
_frontend_dist = __import__("pathlib").Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _frontend_dist.is_dir():
    app.mount("/assets", StaticFiles(directory=_frontend_dist / "assets"), name="assets")

    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith(("api/", "docs", "redoc", "openapi.json")):
            from fastapi.responses import JSONResponse

            return JSONResponse(status_code=404, content={"detail": "Not found"})
        file = _frontend_dist / full_path
        if full_path and file.is_file():
            return FileResponse(file)
        return FileResponse(_frontend_dist / "index.html")
