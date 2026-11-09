"""
Celery application — uses Redis as both broker and result backend.
"""

from celery import Celery
from config import settings

app = Celery(
    "crawler",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["tasks.crawl_tasks"],
)

app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "tasks.crawl_tasks.trigger_all_crawls": {"queue": "default"},
        "tasks.crawl_tasks.trigger_company_url_crawls": {"queue": "default"},
    },
    task_default_queue="default",
    task_queues={
        "default": {},
        "crawl": {},
        "generic": {},
    },
)
