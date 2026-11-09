"""
Workday ATS Crawler.

Workday exposes a consistent POST /jobs JSON endpoint on all tenants.
No HTML scraping needed — pure API calls.

URL pattern:
  https://{tenant}.wd5.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
"""

import asyncio

import httpx
import structlog

from config import settings
from crawlers.base import BaseCrawler
from models import RawJob

logger = structlog.get_logger()

# Some companies use wd3, wd5, wd1 — try in order
WORKDAY_SUBDOMAINS = ["wd5", "wd3", "wd1"]

HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
}


class WorkdayCrawler(BaseCrawler):
    source = "workday"

    async def _fetch_page(
        self,
        client: httpx.AsyncClient,
        url: str,
        offset: int,
        limit: int,
    ) -> dict:
        payload = {
            "appliedFacets": {},
            "limit": limit,
            "offset": offset,
            "searchText": "",
        }
        resp = await client.post(url, json=payload, headers=HEADERS)
        resp.raise_for_status()
        return resp.json()

    async def _resolve_url(self, client: httpx.AsyncClient, config: dict) -> str | None:
        """Try multiple subdomains to find the right Workday URL."""
        tenant = config["tenant"]
        site = config.get("site", "External")

        for sub in WORKDAY_SUBDOMAINS:
            url = f"https://{tenant}.{sub}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs"
            try:
                resp = await client.post(
                    url,
                    json={"appliedFacets": {}, "limit": 1, "offset": 0, "searchText": ""},
                    headers=HEADERS,
                    timeout=15.0,
                )
                if resp.status_code == 200:
                    return url
            except Exception:
                continue
        return None

    async def crawl(self, config: dict) -> list[RawJob]:
        tenant = config["tenant"]
        limit = 20
        all_jobs: list[RawJob] = []

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            url = await self._resolve_url(client, config)
            if not url:
                raise RuntimeError(f"Could not resolve Workday URL for tenant={tenant}")

            offset = 0
            while True:
                data = await self._fetch_page(client, url, offset, limit)
                postings = data.get("jobPostings", [])

                if not postings:
                    break

                for item in postings:
                    external_path = item.get("externalPath", "")
                    # Build canonical URL — strip query params from path
                    job_url = f"https://{tenant}.wd5.myworkdayjobs.com{external_path}"

                    all_jobs.append(
                        RawJob(
                            source=self.source,
                            company=config["company"],
                            title=item.get("title", ""),
                            location=item.get("locationsText", ""),
                            url=job_url,
                            posted_on=item.get("postedOn", ""),
                            raw_data=item,
                        )
                    )

                offset += limit
                total = data.get("total", 0)

                if offset >= total or offset >= settings.MAX_JOBS_PER_COMPANY:
                    break

                await asyncio.sleep(0.5)  # polite rate limiting

        return all_jobs
