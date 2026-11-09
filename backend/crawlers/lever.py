"""
Lever ATS Crawler.

Lever exposes a public JSON API for all job postings.
Endpoint: https://api.lever.co/v0/postings/{company}?mode=json
"""

import httpx
import structlog

from crawlers.base import BaseCrawler
from models import RawJob

logger = structlog.get_logger()

API_URL = "https://api.lever.co/v0/postings/{lever_id}?mode=json&limit=250"

HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (compatible; JobCrawler/1.0)",
}


class LeverCrawler(BaseCrawler):
    source = "lever"

    async def crawl(self, config: dict) -> list[RawJob]:
        lever_id = config["lever_id"]
        url = API_URL.format(lever_id=lever_id)

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=HEADERS)
            resp.raise_for_status()
            data = resp.json()

        jobs: list[RawJob] = []
        for item in data:
            categories = item.get("categories", {})
            location = categories.get("location", "") or categories.get("allLocations", "")

            # Lever tags field is a list of strings
            tags = item.get("tags", [])

            # createdAt is a Unix timestamp in milliseconds
            posted_on = ""
            if item.get("createdAt"):
                posted_on = str(item["createdAt"])

            jobs.append(
                RawJob(
                    source=self.source,
                    company=config["company"],
                    title=item.get("text", ""),
                    location=location,
                    url=item.get("hostedUrl", ""),
                    description=item.get("descriptionPlain", ""),
                    posted_on=posted_on,
                    tags=tags,
                    raw_data=item,
                )
            )

        return jobs
