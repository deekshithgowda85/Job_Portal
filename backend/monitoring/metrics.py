"""
Prometheus metrics for the crawler service.
"""

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Histogram,
    generate_latest,
)

# ─── Counters ─────────────────────────────────────────────────────────────────

crawl_counter = Counter(
    "crawler_crawls_total",
    "Total number of crawl attempts",
    ["source", "status"],
)

jobs_published_counter = Counter(
    "crawler_jobs_published_total",
    "Total number of jobs inserted into the portal",
    ["source"],
)

# ─── Histograms ───────────────────────────────────────────────────────────────

crawl_duration_histogram = Histogram(
    "crawler_crawl_duration_seconds",
    "Duration of each crawl in seconds",
    ["source"],
    buckets=[1, 5, 10, 30, 60, 120, 300],
)


# ─── Output ───────────────────────────────────────────────────────────────────

def get_metrics_output() -> str:
    return generate_latest().decode("utf-8")
