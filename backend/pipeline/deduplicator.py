"""
Deduplicator — Redis-backed fingerprint store.

Uses SETNX + TTL to mark seen jobs.
O(1) per job, no DB hit required for dedup.
"""

import hashlib

import redis.asyncio as aioredis
import structlog

from config import settings
from models import RawJob

logger = structlog.get_logger()

PREFIX = "job:seen:v2:"


def build_fingerprint(company: str, title: str, location: str = "") -> str:
    """
    Stable SHA-256 fingerprint from (company, title, location).
    Lowercased and stripped before hashing to absorb minor variations.
    """
    raw = (
        f"{company.lower().strip()}"
        f"|{title.lower().strip()}"
        f"|{location.lower().strip()}"
    )
    return hashlib.sha256(raw.encode()).hexdigest()


class Deduplicator:
    def __init__(self):
        self._redis: aioredis.Redis | None = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(
                settings.redis_async_url, decode_responses=True
            )
        return self._redis

    async def is_new(self, fingerprint: str) -> bool:
        """
        Returns True if this fingerprint has NOT been seen before.
        Atomically sets the key (SETNX) with TTL on first appearance.
        """
        r = await self._get_redis()
        key = f"{PREFIX}{fingerprint}"
        was_new = await r.setnx(key, "1")
        if was_new:
            ttl = settings.DEDUP_TTL_DAYS * 86400
            await r.expire(key, ttl)
        return bool(was_new)

    async def filter_new(self, jobs: list[RawJob]) -> list[RawJob]:
        """
        Given a list of RawJob, attach fingerprints and return only new ones.
        Duplicates are silently dropped.
        """
        new_jobs: list[RawJob] = []

        for job in jobs:
            fp = build_fingerprint(job.company, job.title, job.location or "")
            if await self.is_new(fp):
                # Attach fingerprint to the job object for downstream use
                job.fingerprint = fp
                new_jobs.append(job)

        logger.info(
            "dedup_complete",
            total=len(jobs),
            new=len(new_jobs),
            duplicates=len(jobs) - len(new_jobs),
        )
        return new_jobs

    async def close(self):
        if self._redis:
            await self._redis.aclose()
