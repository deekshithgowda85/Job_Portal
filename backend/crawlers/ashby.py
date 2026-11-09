"""
Ashby ATS Crawler.

Ashby (used by Linear, Vercel, Loom, etc.) exposes a public GraphQL
and REST endpoint for job listings.
REST endpoint: https://jobs.ashbyhq.com/api/non-user-facing/job-board/listing?organizationHostedJobsPageName={slug}
"""

import httpx
import structlog

from crawlers.base import BaseCrawler
from models import RawJob

logger = structlog.get_logger()

API_URL = (
    "https://jobs.ashbyhq.com/api/non-user-facing/job-board/listing"
    "?organizationHostedJobsPageName={slug}"
)

HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (compatible; JobCrawler/1.0)",
    "Referer": "https://jobs.ashbyhq.com/",
}


class AshbyCrawler(BaseCrawler):
    source = "ashby"

    async def crawl(self, config: dict) -> list[RawJob]:
        slug = config["ashby_slug"]
        url = API_URL.format(slug=slug)

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=HEADERS)
            resp.raise_for_status()
            data = resp.json()

        jobs: list[RawJob] = []
        job_postings = data.get("jobPostings", [])

        for item in job_postings:
            # Ashby nests location as a dict
            location_parts = []
            if item.get("isRemote"):
                location_parts.append("Remote")
            for loc in item.get("secondaryLocations", []):
                if loc.get("city"):
                    location_parts.append(loc["city"])

            location = ", ".join(location_parts) if location_parts else ""

            department = item.get("departmentName", "")
            tags = [department] if department else []

            jobs.append(
                RawJob(
                    source=self.source,
                    company=config["company"],
                    title=item.get("title", ""),
                    location=location,
                    url=f"https://jobs.ashbyhq.com/{slug}/{item.get('id', '')}",
                    posted_on=item.get("publishedDate", ""),
                    tags=tags,
                    raw_data=item,
                )
            )

        return jobs
