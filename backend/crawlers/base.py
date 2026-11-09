"""
BaseCrawler — all crawlers inherit from this.
Wraps crawl() with timing, structured logging, error handling, and metrics.
"""

import abc
import time
from typing import Optional

import structlog

from models import CrawlResult, CrawlStatus, RawJob
from monitoring.metrics import crawl_counter, crawl_duration_histogram

logger = structlog.get_logger()


class BaseCrawler(abc.ABC):
    source: str = "unknown"

    @abc.abstractmethod
    async def crawl(self, config: dict) -> list[RawJob]:
        """
        Fetch raw jobs for a single company config.
        Must be implemented by every crawler.
        Raise any exception on failure — run() catches it.
        """

    async def run(self, config: dict) -> tuple[list[RawJob], CrawlResult]:
        """
        Public entry point. Calls crawl(), records metrics, returns result.
        Always returns (jobs, result) — never raises.
        """
        start = time.monotonic()
        company = config.get("company", "unknown")
        log = logger.bind(source=self.source, company=company)

        try:
            log.info("crawl_started")
            jobs = await self.crawl(config)
            duration_ms = int((time.monotonic() - start) * 1000)

            crawl_counter.labels(source=self.source, status="success").inc()
            crawl_duration_histogram.labels(source=self.source).observe(
                duration_ms / 1000
            )

            log.info(
                "crawl_completed",
                jobs_found=len(jobs),
                duration_ms=duration_ms,
            )

            return jobs, CrawlResult(
                source=self.source,
                company=company,
                status=CrawlStatus.SUCCESS,
                jobs_found=len(jobs),
                duration_ms=duration_ms,
            )

        except Exception as exc:
            duration_ms = int((time.monotonic() - start) * 1000)
            crawl_counter.labels(source=self.source, status="error").inc()
            log.error("crawl_failed", error=str(exc), duration_ms=duration_ms)

            return [], CrawlResult(
                source=self.source,
                company=company,
                status=CrawlStatus.ERROR,
                error=str(exc),
                duration_ms=duration_ms,
            )
