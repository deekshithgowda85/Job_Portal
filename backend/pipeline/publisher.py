"""
Publisher — POSTs normalized job batches to the portal API.

Sends jobs in batches of 50 to avoid request size limits.
Retries on 5xx errors with exponential backoff.
"""

import asyncio
import math

import httpx
import structlog

from config import settings
from models import NormalizedJob

logger = structlog.get_logger()

BATCH_SIZE = 50
MAX_RETRIES = 3


class Publisher:
    def __init__(self):
        self.api_url = settings.PORTAL_API_URL.rstrip("/")
        self.api_key = settings.PORTAL_API_KEY

    async def _post_batch(
        self,
        client: httpx.AsyncClient,
        batch: list[NormalizedJob],
        attempt: int = 0,
    ) -> dict:
        try:
            resp = await client.post(
                f"{self.api_url}/api/jobs",
                json=[j.model_dump(mode="json") for j in batch],
                headers={
                    "X-API-Key": self.api_key,
                    "Content-Type": "application/json",
                },
                timeout=60.0,
            )
            resp.raise_for_status()
            return resp.json()

        except httpx.HTTPStatusError as e:
            logger.error(
                "publisher_request_failed",
                status=e.response.status_code,
                response=e.response.text[:1000],
            )
            if e.response.status_code >= 500 and attempt < MAX_RETRIES:
                delay = 2 ** attempt
                logger.warning(
                    "publisher_retry",
                    attempt=attempt + 1,
                    delay=delay,
                    status=e.response.status_code,
                )
                await asyncio.sleep(delay)
                return await self._post_batch(client, batch, attempt + 1)
            raise

    async def publish_batch(self, jobs: list[NormalizedJob]) -> dict:
        if not jobs:
            return {"inserted": 0, "duplicates": 0}

        total_inserted = 0
        total_duplicates = 0
        num_batches = math.ceil(len(jobs) / BATCH_SIZE)

        async with httpx.AsyncClient() as client:
            for i in range(num_batches):
                batch = jobs[i * BATCH_SIZE : (i + 1) * BATCH_SIZE]
                result = await self._post_batch(client, batch)

                inserted = result.get("inserted", 0)
                duplicates = result.get("duplicates", 0)
                total_inserted += inserted
                total_duplicates += duplicates

                logger.info(
                    "batch_published",
                    batch=f"{i+1}/{num_batches}",
                    inserted=inserted,
                    duplicates=duplicates,
                )

        logger.info(
            "publish_complete",
            total_jobs=len(jobs),
            inserted=total_inserted,
            duplicates=total_duplicates,
        )
        return {"inserted": total_inserted, "duplicates": total_duplicates}
