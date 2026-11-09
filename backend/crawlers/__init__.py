from crawlers.ashby import AshbyCrawler
from crawlers.generic_html import GenericHTMLCrawler
from crawlers.greenhouse import GreenhouseCrawler
from crawlers.lever import LeverCrawler
from crawlers.linkedin import LinkedInCrawler
from crawlers.naukri import NaukriCrawler
from crawlers.workday import WorkdayCrawler

__all__ = [
    "WorkdayCrawler",
    "GreenhouseCrawler",
    "LeverCrawler",
    "AshbyCrawler",
    "LinkedInCrawler",
    "NaukriCrawler",
    "GenericHTMLCrawler",
]

# Registry — maps source name to crawler instance
CRAWLER_REGISTRY: dict = {
    "workday": WorkdayCrawler(),
    "greenhouse": GreenhouseCrawler(),
    "lever": LeverCrawler(),
    "ashby": AshbyCrawler(),
    "linkedin": LinkedInCrawler(),
    "naukri": NaukriCrawler(),
    "generic": GenericHTMLCrawler(),
}
