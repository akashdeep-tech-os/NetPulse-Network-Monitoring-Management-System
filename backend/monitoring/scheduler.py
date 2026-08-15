"""Background scheduler: monitoring loop + housekeeping jobs."""
import asyncio
import logging

from core.config import settings

logger = logging.getLogger(__name__)


async def monitoring_loop() -> None:
    """Runs due checks every tick. All blocking work happens in worker threads."""
    from monitoring.engine import run_all_due
    from monitoring.housekeeping import cleanup_old_results, prune_stale_devices

    await asyncio.sleep(3)
    while True:
        try:
            await asyncio.to_thread(run_all_due)
        except Exception as e:
            logger.exception(f"Monitoring loop error: {e}")
        await asyncio.sleep(settings.SCHEDULER_TICK_SECONDS)


async def housekeeping_loop() -> None:
    """Runs every 15 minutes: data retention cleanup, stale status pruning."""
    from monitoring.housekeeping import cleanup_old_results, prune_stale_devices

    await asyncio.sleep(60)
    while True:
        try:
            await asyncio.to_thread(cleanup_old_results)
            await asyncio.to_thread(prune_stale_devices)
        except Exception as e:
            logger.exception(f"Housekeeping error: {e}")
        await asyncio.sleep(900)


async def ai_insight_loop() -> None:
    """Runs hourly: anomaly detection + recommendations for all organizations."""
    await asyncio.sleep(120)
    while True:
        try:
            from ai.jobs import run_detection_job

            await asyncio.to_thread(run_detection_job)
        except Exception as e:
            logger.exception(f"AI insight loop error: {e}")
        await asyncio.sleep(3600)
