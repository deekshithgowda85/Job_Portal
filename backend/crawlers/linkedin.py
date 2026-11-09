"""
LinkedIn Job Crawler using Playwright.

Uses the public /jobs/search page — no login required.
Applies anti-bot techniques: UA rotation, resource blocking, 
JS fingerprint masking, random delays.

NOTE: LinkedIn's terms of service restrict automated access.
Use responsibly — limit crawl frequency and volume.
"""

import asyncio
import random
from urllib.parse import quote_plus

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
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.0 Safari/605.1.15",
]

BLOCKED_RESOURCE_TYPES = {"image", "media", "font", "other"}
BLOCKED_URL_PATTERNS = [
    "**/analytics*",
    "**/tracking*",
    "**/beacon*",
    "**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,ico}",
]

# Anti-fingerprint init script
INIT_SCRIPT = """
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    window.chrome = { runtime: {} };
"""


class LinkedInCrawler(BaseCrawler):
    source = "linkedin"

    def _build_url(self, config: dict) -> str:
        keywords = quote_plus(config.get("keywords", "software engineer"))
        location = quote_plus(config.get("location", "India"))
        experience = config.get("experience", "1")
        experience_filter = "2" if experience == "0" else "2,3"
        # f_TPR=r86400 → posted in last 24h; sortBy=DD → date descending
        return (
            f"https://www.linkedin.com/jobs/search/"
            f"?keywords={keywords}&location={location}"
            f"&f_E={quote_plus(experience_filter)}"
            f"&f_TPR=r86400&sortBy=DD&position=1&pageNum=0"
        )

    async def crawl(self, config: dict) -> list[RawJob]:
        jobs: list[RawJob] = []
        url = self._build_url(config)

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=settings.PLAYWRIGHT_HEADLESS,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-features=IsolateOrigins,site-per-process",
                ],
            )

            context = await browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                viewport={"width": 1366, "height": 768},
                locale="en-US",
                timezone_id="Asia/Kolkata",
            )

            # Block heavy resources to speed up crawl
            async def block_resource(route, request):
                if request.resource_type in BLOCKED_RESOURCE_TYPES:
                    await route.abort()
                else:
                    await route.continue_()

            await context.route("**/*", block_resource)

            # Block analytics URLs
            for pattern in BLOCKED_URL_PATTERNS:
                await context.route(pattern, lambda r, _: r.abort())

            page = await context.new_page()
            await page.add_init_script(INIT_SCRIPT)

            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(random.uniform(2.0, 3.5))

                # Scroll to load more jobs (LinkedIn lazy-loads)
                for _ in range(4):
                    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    await asyncio.sleep(random.uniform(1.2, 2.0))

                # Try the newer selector first, fallback to older
                selectors = [
                    ".jobs-search__results-list li",
                    ".base-card",
                    ".job-search-card",
                ]

                job_cards = []
                for selector in selectors:
                    job_cards = await page.query_selector_all(selector)
                    if job_cards:
                        break

                logger.info(
                    "linkedin_cards_found",
                    count=len(job_cards),
                    config=config.get("company", config.get("keywords", "")),
                )

                for card in job_cards[:60]:  # cap at 60 per search
                    try:
                        title = await self._get_text(card, [
                            ".base-search-card__title",
                            "h3.base-search-card__title",
                            ".job-search-card__title",
                        ])
                        company_name = await self._get_text(card, [
                            ".base-search-card__subtitle",
                            "h4.base-search-card__subtitle",
                            ".job-search-card__company-name",
                        ])
                        location_text = await self._get_text(card, [
                            ".job-search-card__location",
                            ".base-search-card__metadata",
                        ])
                        link_el = await card.query_selector(
                            "a.base-card__full-link, a.job-search-card__list-date"
                        )
                        job_url = ""
                        if link_el:
                            href = await link_el.get_attribute("href")
                            # Strip tracking query params, keep only the path
                            job_url = href.split("?")[0] if href else ""

                        if title and job_url:
                            jobs.append(
                                RawJob(
                                    source=self.source,
                                    company=company_name.strip() if company_name else config.get("company", ""),
                                    title=title.strip(),
                                    location=location_text.strip() if location_text else "",
                                    url=job_url,
                                )
                            )
                    except Exception as parse_err:
                        logger.warning("linkedin_card_parse_error", error=str(parse_err))
                        continue

            except Exception as page_err:
                logger.error("linkedin_page_error", error=str(page_err), url=url)
                raise

            finally:
                await browser.close()

        return jobs

    @staticmethod
    async def _get_text(element, selectors: list[str]) -> str:
        """Try multiple selectors, return first match's inner text."""
        for sel in selectors:
            try:
                el = await element.query_selector(sel)
                if el:
                    text = await el.inner_text()
                    return text.strip()
            except Exception:
                continue
        return ""
