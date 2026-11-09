"""
Celery tasks — one task per company crawl, one task to orchestrate all.

Flow per company:
  crawl → dedup → normalize → profile-filter → publish → log
"""

import asyncio
from uuid import uuid4

import httpx
import structlog

from celery_app import app
from companies.loader import load_companies, load_company_urls, load_profile
from config import settings
from crawlers import CRAWLER_REGISTRY
from monitoring.metrics import jobs_published_counter
from pipeline.deduplicator import Deduplicator
from pipeline.normalizer import normalize
from pipeline.profile_filter import ProfileFilter
from pipeline.publisher import Publisher

logger = structlog.get_logger()

COMPANY_CAREER_KEYWORDS = (
    "java", "spring boot", "backend", "software engineer", "sde", "associate software engineer",
    "graduate engineer trainee", "devops", "devsecops", "site reliability", "sre",
    "kubernetes", "platform engineer", "cloud engineer", "full stack", "react", "next.js",
    "node", "llm", "generative ai", "ai engineer", "intern", "2027 batch", "fresher",
    "entry level", "graduate",
)

COMPANY_CAREER_EXCLUDES = (
    "senior", "sr.", "lead", "principal", "staff", "manager", "architect", "director",
    "sales", "marketing", "content", "hr", "php", ".net", "salesforce", "sap",
    "manual testing", "support", "bpo",
)


def _is_permanent_crawl_error(error: str | None) -> bool:
    """Return whether retrying the reported crawler error cannot help."""
    if not error:
        return False
    permanent_markers = (
        "404 Not Found",
        "HTTP/1.1 404",
        "ERR_CERT_DATE_INVALID",
        "ERR_NAME_NOT_RESOLVED",
        "CERTIFICATE_VERIFY_FAILED",
    )
    return any(marker in error for marker in permanent_markers)


async def _report_crawl_log(
    source: str,
    company: str,
    status: str,
    jobs_found: int = 0,
    jobs_new: int = 0,
    error: str | None = None,
    duration_ms: int | None = None,
    run_id: str | None = None,
    task_index: int | None = None,
    total_tasks: int | None = None,
) -> None:
    """Report crawl activity to the portal so it appears on the dashboard."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{settings.PORTAL_API_URL.rstrip('/')}/api/crawl/log",
                json={
                    "source": source,
                    "company": company,
                    "status": status,
                    "jobs_found": jobs_found,
                    "jobs_new": jobs_new,
                    "error": error,
                    "duration_ms": duration_ms,
                    "run_id": run_id,
                    "task_index": task_index,
                    "total_tasks": total_tasks,
                },
                headers={"X-API-Key": settings.PORTAL_API_KEY},
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error(
            "crawl_log_report_failed",
            source=source,
            company=company,
            error=str(exc),
        )


@app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    queue="crawl",
    name="tasks.crawl_company",
)
def crawl_company(self, source: str, config: dict):
    """
    Full pipeline for a single company:
      crawl → dedup → normalize → profile-filter → publish
    """

    async def _run():
        log = logger.bind(source=source, company=config.get("company", "?"))
        crawler = CRAWLER_REGISTRY.get(source)
        run_id = config.get("_run_id")
        task_index = config.get("_task_index")
        total_tasks = config.get("_total_tasks")

        if not crawler:
            log.error("unknown_source")
            return

        await _report_crawl_log(
            source, config.get("company", "?"), "running",
            run_id=run_id, task_index=task_index, total_tasks=total_tasks,
        )
        log.info("crawl_url", url=config.get("career_url", config.get("url", "")))

        # 1. Crawl
        raw_jobs, result = await crawler.run(config)
        search_experience = config.get("experience")
        if search_experience is None and source == "linkedin":
            search_experience = "1"
        if search_experience is not None:
            for raw_job in raw_jobs:
                raw_job.raw_data.setdefault("search_experience", search_experience)

        if result.status.value == "error":
            await _report_crawl_log(
                source,
                config.get("company", "?"),
                "error",
                error=result.error,
                duration_ms=result.duration_ms,
                run_id=run_id, task_index=task_index, total_tasks=total_tasks,
            )
            if _is_permanent_crawl_error(result.error):
                log.warning("crawl_not_retried", error=result.error)
                return
            raise self.retry(exc=Exception(result.error or "crawl error"))

        if not raw_jobs:
            await _report_crawl_log(
                source,
                config.get("company", "?"),
                "success",
                duration_ms=result.duration_ms,
                run_id=run_id, task_index=task_index, total_tasks=total_tasks,
            )
            log.info("no_jobs_found")
            return

        # 2. Dedup
        dedup = Deduplicator()
        new_raw = await dedup.filter_new(raw_jobs)
        await dedup.close()

        if not new_raw:
            await _report_crawl_log(
                source,
                config.get("company", "?"),
                "success",
                jobs_found=len(raw_jobs),
                duration_ms=result.duration_ms,
                run_id=run_id, task_index=task_index, total_tasks=total_tasks,
            )
            log.info("all_duplicates", count=len(raw_jobs))
            return

        # 3. Normalize
        normalized = [normalize(j) for j in new_raw]

        # 4. Profile filter
        profile = load_profile()
        pf = ProfileFilter(profile)
        filtered = pf.filter(normalized)
        if source == "generic":
            filtered = [
                job for job in filtered
                if any(
                    keyword in f"{job.title} {job.description or ''}".lower()
                    for keyword in COMPANY_CAREER_KEYWORDS
                )
                and not any(
                    excluded in f"{job.title} {job.description or ''}".lower()
                    for excluded in COMPANY_CAREER_EXCLUDES
                )
            ]

        if not filtered:
            await _report_crawl_log(
                source,
                config.get("company", "?"),
                "success",
                jobs_found=len(raw_jobs),
                jobs_new=len(new_raw),
                duration_ms=result.duration_ms,
                run_id=run_id, task_index=task_index, total_tasks=total_tasks,
            )
            log.info("all_filtered_by_profile", before=len(normalized))
            return

        # 5. Publish
        try:
            publisher = Publisher()
            pub_result = await publisher.publish_batch(filtered)
        except Exception as exc:
            await _report_crawl_log(
                source,
                config.get("company", "?"),
                "error",
                jobs_found=len(raw_jobs),
                jobs_new=len(new_raw),
                error=str(exc),
                duration_ms=result.duration_ms,
                run_id=run_id, task_index=task_index, total_tasks=total_tasks,
            )
            raise

        inserted = pub_result.get("inserted", 0)
        jobs_published_counter.labels(source=source).inc(inserted)
        await _report_crawl_log(
            source,
            config.get("company", "?"),
            "success",
            jobs_found=len(raw_jobs),
            jobs_new=inserted,
            duration_ms=result.duration_ms,
            run_id=run_id, task_index=task_index, total_tasks=total_tasks,
        )

        log.info(
            "pipeline_complete",
            crawled=len(raw_jobs),
            new=len(new_raw),
            after_filter=len(filtered),
            inserted=inserted,
        )

    asyncio.run(_run())


@app.task(name="tasks.trigger_all_crawls", queue="default")
def trigger_all_crawls(sources: list[str] | None = None):
    """
    Loads all company configs and dispatches individual crawl_company tasks.
    Pass sources=['linkedin'] to restrict to a specific set.
    """
    companies = load_companies()
    run_id = str(uuid4())
    crawl_configs = []

    for source, source_configs in companies.items():
        if sources and source not in sources:
            continue

        for config in source_configs:
            crawl_configs.append((source, config))

    if not sources or "generic" in sources:
        for config in load_company_urls():
            crawl_configs.append(("generic", {"company": config["company"], "career_url": config["url"]}))

    total = len(crawl_configs)
    source_counts = {}
    for source, _ in crawl_configs:
        source_counts[source] = source_counts.get(source, 0) + 1
    if total:
        _report_queue(run_id, sources[0] if sources and len(sources) == 1 else "all", total)
    for index, (source, config) in enumerate(crawl_configs):
        config = {**config, "_run_id": run_id, "_task_index": index, "_total_tasks": total}
        queue = "generic" if source == "generic" else "crawl"
        crawl_company.apply_async(args=[source, config], queue=queue)

    logger.info("all_crawls_dispatched", total=total, source_counts=source_counts, sources=sources or "all")
    return {"dispatched": total}


@app.task(name="tasks.trigger_company_url_crawls", queue="default")
def trigger_company_url_crawls():
    """Dispatch crawls for every generic career portal URL."""
    run_id = str(uuid4())
    configs = load_company_urls()
    total = len(configs)
    if total:
        _report_queue(run_id, "generic", total)
    for index, config in enumerate(configs):
        crawl_company.apply_async(
            args=["generic", {**config, "career_url": config["url"], "_run_id": run_id, "_task_index": index, "_total_tasks": total}],
            queue="generic",
        )

    logger.info("company_url_crawls_dispatched", total=total)
    return {"dispatched": total}


def _report_queue(run_id: str, source: str, total_tasks: int) -> None:
    async def _send():
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{settings.PORTAL_API_URL.rstrip('/')}/api/crawl/queue",
                json={"run_id": run_id, "source": source, "total_tasks": total_tasks},
                headers={"X-API-Key": settings.PORTAL_API_KEY},
            )
            response.raise_for_status()
    asyncio.run(_send())


@app.task(name="tasks.cleanup_expired_data", queue="default")
def cleanup_expired_data():
    """Delete crawled jobs and crawl history older than seven days."""

    async def _run():
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.PORTAL_API_URL.rstrip('/')}/api/maintenance/cleanup",
                headers={"X-API-Key": settings.PORTAL_API_KEY},
                json={"retention_days": 7},
            )
            response.raise_for_status()
            result = response.json()
            logger.info(
                "expired_data_cleaned",
                deleted_jobs=result.get("deleted_jobs", 0),
                deleted_ineligible_jobs=result.get("deleted_ineligible_jobs", 0),
                deleted_crawl_logs=result.get("deleted_crawl_logs", 0),
                deleted_alert_history=result.get("deleted_alert_history", 0),
            )
            return result

    return asyncio.run(_run())
