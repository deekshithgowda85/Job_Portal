"""
Generic HTML Crawler — fallback for companies with custom career pages.

Each company config supplies CSS selectors for:
  - job_list: container or list of job items
  - title: job title element within each item
  - location: location element (optional)
  - link: anchor element for the job URL
"""

import asyncio
import random
from urllib.parse import urljoin, urlparse

import structlog
from playwright.async_api import async_playwright

from config import settings
from crawlers.base import BaseCrawler
from models import RawJob

logger = structlog.get_logger()

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
]


class GenericHTMLCrawler(BaseCrawler):
    source = "generic"

    async def crawl(self, config: dict) -> list[RawJob]:
        """
        config keys:
          - company: str
          - career_url: str  — full URL of the careers/jobs page
          - selectors.job_list: CSS selector for each job row/card
          - selectors.title: CSS selector for title (relative to job_list item)
          - selectors.location: CSS selector for location (optional)
          - selectors.link: CSS selector for the <a> tag (or use job_list item itself)
          - base_url: str (optional, prepended to relative hrefs)
        """
        career_url = config["career_url"]
        selectors = config.get("selectors", {})
        base_url = config.get("base_url", career_url)
        jobs: list[RawJob] = []

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=settings.PLAYWRIGHT_HEADLESS,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            context = await browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                viewport={"width": 1280, "height": 900},
                ignore_https_errors=True,
            )

            async def block_media(route, request):
                if request.resource_type in {"image", "media", "font"}:
                    await route.abort()
                else:
                    await route.continue_()

            await context.route("**/*", block_media)
            page = await context.new_page()

            try:
                await page.goto(career_url, wait_until="networkidle", timeout=35000)
                await asyncio.sleep(random.uniform(1.0, 2.0))

                job_list_selector = selectors.get("job_list", "")
                if not job_list_selector:
                    return await self._discover_job_links(page, config["company"], career_url)

                await page.wait_for_selector(job_list_selector, timeout=10000)
                cards = await page.query_selector_all(job_list_selector)

                for card in cards[:60]:
                    try:
                        title = ""
                        location = ""
                        url = ""

                        if selectors.get("title"):
                            title_el = await card.query_selector(selectors["title"])
                            if title_el:
                                title = (await title_el.inner_text()).strip()

                        if selectors.get("location"):
                            loc_el = await card.query_selector(selectors["location"])
                            if loc_el:
                                location = (await loc_el.inner_text()).strip()

                        link_el = await card.query_selector(selectors.get("link", "a"))
                        if link_el:
                            href = await link_el.get_attribute("href") or ""
                            url = href if href.startswith("http") else f"{base_url}{href}"
                            if not title:
                                title = (await link_el.inner_text()).strip()

                        if title and url:
                            jobs.append(RawJob(
                                source=self.source,
                                company=config["company"],
                                title=title,
                                location=location,
                                url=url,
                            ))
                    except Exception as e:
                        logger.warning("generic_card_error", error=str(e))

            except Exception as e:
                logger.error("generic_page_error", url=career_url, error=str(e))
                raise
            finally:
                await browser.close()

        return jobs

    async def _discover_job_links(
        self, page, company: str, career_url: str
    ) -> list[RawJob]:
        """Extract likely job links when a portal has no configured selectors."""
        keywords = (
            "job", "jobs", "career", "careers", "opening", "openings",
            "position", "positions", "opportunity", "opportunities",
        )
        links = await page.query_selector_all("a[href]")
        jobs: list[RawJob] = []
        seen_urls: set[str] = set()
        for link in links:
            text = " ".join((await link.inner_text()).split())
            href = await link.get_attribute("href") or ""
            url = urljoin(career_url, href)
            path = urlparse(url).path.lower()
            if not text or not href or url in seen_urls:
                continue
            if not any(keyword in f"{text.lower()} {path}" for keyword in keywords):
                continue
            if urlparse(url).netloc != urlparse(career_url).netloc:
                continue
            seen_urls.add(url)
            jobs.append(RawJob(
                source=self.source,
                company=company,
                title=text,
                location="",
                url=url,
            ))
            if len(jobs) >= 60:
                break
        return jobs
