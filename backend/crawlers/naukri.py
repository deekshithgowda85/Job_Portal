"""
Naukri.com Job Crawler using Playwright.

Naukri's search page returns JSON inside a <script id="__NEXT_DATA__"> tag
on Next.js pages — we extract that directly instead of parsing HTML DOM.
"""

import asyncio
import json
import random

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


class NaukriCrawler(BaseCrawler):
    source = "naukri"

    def _build_url(self, config: dict) -> str:
        keywords = config.get("keywords", "software engineer")
        location = config.get("location", "")
        experience = config.get("experience", "0")
        keyword_slug = keywords.lower().replace(" ", "-")
        location_slug = location.lower().replace(" ", "-") if location else ""
        base = f"https://www.naukri.com/{keyword_slug}-jobs"
        if location_slug:
            base += f"-in-{location_slug}"
        base += f"?experience={experience}&nignbevent_src=jobsearchDeskGNB"
        return base

    async def crawl(self, config: dict) -> list[RawJob]:
        url = self._build_url(config)
        jobs: list[RawJob] = []

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=settings.PLAYWRIGHT_HEADLESS,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            context = await browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                viewport={"width": 1280, "height": 800},
                locale="en-IN",
            )

            # Block images and fonts
            async def block_heavy(route, request):
                if request.resource_type in {"image", "media", "font"}:
                    await route.abort()
                else:
                    await route.continue_()

            await context.route("**/*", block_heavy)
            page = await context.new_page()

            try:
                await page.goto(url, wait_until="networkidle", timeout=35000)
                await asyncio.sleep(random.uniform(1.5, 2.5))

                # Strategy 1: Extract from __NEXT_DATA__ JSON blob (fastest)
                next_data_text = await page.evaluate("""() => {
                    const el = document.getElementById('__NEXT_DATA__');
                    return el ? el.textContent : null;
                }""")

                if next_data_text:
                    try:
                        next_data = json.loads(next_data_text)
                        job_list = (
                            next_data
                            .get("props", {})
                            .get("pageProps", {})
                            .get("jobDetails", [])
                        )
                        for item in job_list[:50]:
                            jobs.append(RawJob(
                                source=self.source,
                                company=item.get("companyName", ""),
                                title=item.get("title", ""),
                                location=", ".join(item.get("placeholders", {}).get("location", "").split(",")),
                                url=item.get("jdURL", ""),
                                posted_on=item.get("footerPlaceholderLabel", ""),
                                raw_data=item,
                            ))
                        if jobs:
                            return jobs
                    except (json.JSONDecodeError, KeyError):
                        pass

                # Strategy 2: DOM scraping fallback
                await page.wait_for_selector(".srp-jobtuple-wrapper, article.jobTuple", timeout=10000)
                cards = await page.query_selector_all(".srp-jobtuple-wrapper, article.jobTuple")

                for card in cards[:50]:
                    try:
                        title_el = await card.query_selector(".title, .jobTitle")
                        company_el = await card.query_selector(".comp-name, .companyInfo")
                        location_el = await card.query_selector(".locWdth, .location")
                        link_el = await card.query_selector("a.title, a.jobTitle")

                        title = (await title_el.inner_text()).strip() if title_el else ""
                        company = (await company_el.inner_text()).strip() if company_el else ""
                        location = (await location_el.inner_text()).strip() if location_el else ""
                        link = await link_el.get_attribute("href") if link_el else ""

                        if title and link:
                            jobs.append(RawJob(
                                source=self.source,
                                company=company,
                                title=title,
                                location=location,
                                url=link,
                            ))
                    except Exception as e:
                        logger.warning("naukri_card_error", error=str(e))

            except Exception as e:
                logger.error("naukri_page_error", error=str(e))
                raise
            finally:
                await browser.close()

        return jobs
