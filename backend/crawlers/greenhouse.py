"""
Greenhouse ATS Crawler.

Greenhouse exposes a fully public REST API — no auth needed.
Endpoint: https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true
"""

import httpx
import structlog

from crawlers.base import BaseCrawler
from models import RawJob

logger = structlog.get_logger()

API_URL = "https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true"

HEADERS = {
    "Accept": "application/json",
    "User-Agent": (
        "Mozilla/5.0 (compatible; JobCrawler/1.0; "
        "+https://github.com/jobcrawler)"
    ),
}


class GreenhouseCrawler(BaseCrawler):
    source = "greenhouse"

    async def crawl(self, config: dict) -> list[RawJob]:
        board_token = config["board_token"]
        url = API_URL.format(board_token=board_token)

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=HEADERS)
            resp.raise_for_status()
            data = resp.json()

        jobs: list[RawJob] = []
        for item in data.get("jobs", []):
            # Greenhouse nests location inside a dict
            location_obj = item.get("location", {})
            location = (
                location_obj.get("name", "") if isinstance(location_obj, dict) else ""
            )

            # Departments as tags
            departments = item.get("departments", [])
            tags = [d["name"] for d in departments if d.get("name")]

            jobs.append(
                RawJob(
                    source=self.source,
                    company=config["company"],
                    title=item.get("title", ""),
                    location=location,
                    url=item.get("absolute_url", ""),
                    description=item.get("content", ""),
                    posted_on=item.get("updated_at", ""),
                    tags=tags,
                    raw_data=item,
                )
            )

        return jobs
