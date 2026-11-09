"""
Job Crawler Service — FastAPI entry point.
Exposes health, metrics, manual trigger, and profile management endpoints.
"""

import asyncio
import threading
from contextlib import asynccontextmanager

import structlog
import uvicorn
from celery.exceptions import CeleryError
from fastapi import Depends, FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from config import settings
from monitoring.metrics import get_metrics_output
from tasks.scheduler import start_scheduler

logger = structlog.get_logger()


def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != settings.SERVICE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("crawler_service_starting")
    # Start APScheduler in a background thread
    scheduler_thread = threading.Thread(target=start_scheduler, daemon=True)
    scheduler_thread.start()
    logger.info("scheduler_started_in_background")
    yield
    logger.info("crawler_service_shutting_down")


app = FastAPI(
    title="Job Crawler Service",
    version="1.0.0",
    description="Production-grade job crawling microservice",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CrawlTrigger(BaseModel):
    source: str | None = None


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


# ─── Metrics ──────────────────────────────────────────────────────────────────

@app.get("/metrics")
def metrics():
    return Response(content=get_metrics_output(), media_type="text/plain")


# ─── Crawl triggers ───────────────────────────────────────────────────────────

@app.post("/crawl/all", dependencies=[Depends(verify_api_key)])
def crawl_all(trigger: CrawlTrigger | None = None):
    from tasks.crawl_tasks import trigger_all_crawls
    source = trigger.source if trigger else None
    sources = [source] if source else None
    try:
        trigger_all_crawls.delay(sources)
    except (CeleryError, OSError, ValueError) as exc:
        logger.error("crawl_dispatch_failed", error=str(exc))
        raise HTTPException(
            status_code=503,
            detail="Crawler queue is unavailable. Check the Redis connection.",
        ) from exc
    return {"message": "Crawl triggered", "source": source or "all"}


@app.post("/crawl/company-urls", dependencies=[Depends(verify_api_key)])
def crawl_company_urls():
    from tasks.crawl_tasks import trigger_company_url_crawls

    try:
        task = trigger_company_url_crawls.delay()
    except (CeleryError, OSError, ValueError) as exc:
        logger.error("company_url_crawl_dispatch_failed", error=str(exc))
        raise HTTPException(
            status_code=503,
            detail="Company URL queue is unavailable. Check the Redis connection.",
        ) from exc
    return {"message": "Company URL crawl triggered", "task_id": task.id, "source": "generic"}


@app.post("/crawl/source/{source}", dependencies=[Depends(verify_api_key)])
def crawl_source(source: str, config: dict):
    from tasks.crawl_tasks import crawl_company
    crawl_company.apply_async(args=[source, config])
    return {"message": f"Crawl triggered for {source}"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
