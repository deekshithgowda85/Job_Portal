"""
Central configuration loaded from environment variables via pydantic-settings.
"""

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Portal API (Next.js frontend)
    PORTAL_API_URL: str = "http://localhost:3000"
    PORTAL_API_KEY: str = "changeme"

    # This service's own API key (for /crawl/* endpoints)
    SERVICE_API_KEY: str = "changeme-service"

    # Playwright
    PLAYWRIGHT_HEADLESS: bool = True

    # Max jobs to fetch per company per crawl
    MAX_JOBS_PER_COMPANY: int = 100

    # Dedup TTL in days
    DEDUP_TTL_DAYS: int = 7

    # Concurrency for Celery workers
    WORKER_CONCURRENCY: int = 4

    # Optional: comma-separated proxy list (leave empty to disable)
    PROXY_LIST: str = ""

    @property
    def proxy_list(self) -> list[str]:
        return [p.strip() for p in self.PROXY_LIST.split(",") if p.strip()]

    @property
    def redis_url(self) -> str:
        """Return a Redis URL compatible with Celery's Redis transport."""
        if not self.REDIS_URL.startswith("rediss://"):
            return self.REDIS_URL

        parts = urlsplit(self.REDIS_URL)
        query = dict(parse_qsl(parts.query, keep_blank_values=True))
        query.setdefault("ssl_cert_reqs", "CERT_REQUIRED")
        return urlunsplit(parts._replace(query=urlencode(query)))

    @property
    def redis_async_url(self) -> str:
        """Return a Redis URL compatible with redis-py's async TLS client."""
        if not self.REDIS_URL.startswith("rediss://"):
            return self.REDIS_URL

        parts = urlsplit(self.REDIS_URL)
        query = dict(parse_qsl(parts.query, keep_blank_values=True))
        query["ssl_cert_reqs"] = "required"
        return urlunsplit(parts._replace(query=urlencode(query)))


settings = Settings()
