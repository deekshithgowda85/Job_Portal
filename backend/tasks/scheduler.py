"""
Scheduler — runs automatically inside docker-compose.
No manual trigger needed. Fully autonomous.

Schedule (IST):
  Daily 05:30 AM IST  →  delete crawled data older than seven days
  Sunday 06:00 AM IST  →  full crawl (all ATS sources and company URLs)

APScheduler runs in a background thread inside the FastAPI process.
"""

import structlog
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = structlog.get_logger()


def start_scheduler():
    # Use Asia/Kolkata so cron times are always in IST
    # — no manual UTC offset math, handles DST-equivalent correctly
    scheduler = BlockingScheduler(timezone="Asia/Kolkata")

    # ── Monday-Saturday 06:00 IST — daily ATS, LinkedIn, and generic crawl ───
    scheduler.add_job(
        _trigger_daily_sources,
        CronTrigger(
            day_of_week="mon-sat",
            hour=6,
            minute=0,
            timezone="Asia/Kolkata",
        ),
        id="daily_source_crawl",
        name="Daily full crawl (Monday-Saturday 06:00 IST)",
        replace_existing=True,
        misfire_grace_time=600,
    )

    # ── Every 3 days — all generic career portal URLs ────────────────────────
    scheduler.add_job(
        _trigger_company_url_crawls,
        IntervalTrigger(days=3, timezone="Asia/Kolkata"),
        id="company_url_crawl",
        name="All company career portals (every 3 days)",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # ── Sunday 06:00 IST — weekly full crawl ─────────────────────────────────
    scheduler.add_job(
        _trigger_all,
        CronTrigger(day_of_week="sun", hour=6, minute=0, timezone="Asia/Kolkata"),
        id="weekly_crawl",
        name="Weekly full crawl (Sunday 06:00 IST)",
        replace_existing=True,
        misfire_grace_time=600,
    )

    scheduler.add_job(
        _trigger_cleanup,
        CronTrigger(
            hour=5,
            minute=30,
            timezone="Asia/Kolkata",
        ),
        id="weekly_data_cleanup",
        name="Delete data older than 7 days (daily 05:30 IST)",
        replace_existing=True,
        misfire_grace_time=600,
    )

    _log_next_runs(scheduler)

    logger.info(
        "scheduler_ready",
        daily="Monday-Saturday 06:00 IST (ATS, LinkedIn, and generic portals)",
        every_three_days="all company career URLs",
        weekly="Sunday 06:00 IST",
        cleanup="daily 05:30 IST (data older than 7 days)",
        timezone="Asia/Kolkata",
    )

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("scheduler_stopped")


def _trigger_all():
    """Dispatches every ATS, LinkedIn, and generic career portal crawl."""
    from tasks.crawl_tasks import trigger_all_crawls
    logger.info("scheduled_crawl_fired")
    trigger_all_crawls.delay()


def _trigger_daily_sources():
    """Dispatches daily ATS, LinkedIn, and generic portal crawls."""
    from tasks.crawl_tasks import trigger_all_crawls
    logger.info("scheduled_daily_source_crawl_fired")
    trigger_all_crawls.delay(
        ["linkedin", "workday", "naukri", "greenhouse", "lever", "ashby", "generic"]
    )


def _trigger_company_url_crawls():
    """Dispatches every generic career portal URL crawl."""
    from tasks.crawl_tasks import trigger_company_url_crawls
    logger.info("scheduled_company_url_crawl_fired")
    trigger_company_url_crawls.delay()


def _trigger_cleanup():
    from tasks.crawl_tasks import cleanup_expired_data
    logger.info("scheduled_cleanup_fired")
    cleanup_expired_data.delay()


def _log_next_runs(scheduler: BlockingScheduler):
    """Logs the next scheduled run time for each job at startup."""
    for job in scheduler.get_jobs():
        # Pending jobs do not have next_run_time until the scheduler starts.
        next_run = getattr(job, "next_run_time", None)
        logger.info(
            "next_scheduled_run",
            job=job.name,
            next_run=str(next_run) if next_run else "not scheduled",
        )
