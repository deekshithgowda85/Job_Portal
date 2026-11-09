# Job Crawler Service

Production-grade microservice that crawls 200+ company job portals and 
delivers deduplicated, filtered job listings to the job portal API.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    APScheduler (cron)                    │
│       daily sources, every 3 days portals, Sunday all    │
└──────────────────────┬──────────────────────────────────┘
                       │  trigger_all_crawls task
           ┌───────────▼───────────┐
           │   Celery Workers (4)  │  Redis broker
           │   crawl_company tasks │  one task per company
           └───────────┬───────────┘
                       │
       ┌───────────────┼──────────────────┐
       │               │                  │
  Workday API    Greenhouse API      LinkedIn
  Lever API       Ashby API         Naukri
  (httpx)        (httpx)          (Playwright)
       │               │                  │
       └───────────────┴──────────────────┘
                       │  RawJob[]
           ┌───────────▼───────────┐
           │      Deduplicator     │  Redis SETNX
           │   (fingerprint store) │  7-day TTL
           └───────────┬───────────┘
                       │  new RawJob[]
           ┌───────────▼───────────┐
           │      Normalizer       │  detect type, level, date
           └───────────┬───────────┘
                       │  NormalizedJob[]
           ┌───────────▼───────────┐
           │    Profile Filter     │  profile.yaml rules
           │  keywords, titles,    │
           │  locations, XP level  │
           └───────────┬───────────┘
                       │  filtered NormalizedJob[]
           ┌───────────▼───────────┐
           │      Publisher        │  POST /api/jobs
           │  (batches of 50)      │  to Next.js portal
           └───────────────────────┘
```

---

## Quick Start

```bash
# 1. Clone and enter the project
cd crawler

# 2. Copy and fill in env vars
cp .env.example .env
# Edit .env: set PORTAL_API_URL and PORTAL_API_KEY

# 3. Edit your matching profile
nano profile.yaml

# 4. Start everything
docker-compose up --build -d

# 5. Check health
curl http://localhost:8000/health

# 6. View Flower (Celery UI)
# http://localhost:5555  (admin:admin)

# 7. Trigger a manual crawl now
curl -X POST http://localhost:8000/crawl/all \
  -H "X-Api-Key: your-service-api-key"
```

### Local Windows run

Run the API and Celery worker in separate PowerShell windows:

```powershell
cd D:\Github\Job-portal\backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

```powershell
cd D:\Github\Job-portal\backend
.\.venv\Scripts\Activate.ps1
celery -A celery_app worker --loglevel=info -Q crawl,default --pool=solo --concurrency=1
```

The `solo` pool is required for local Windows runs. Linux/Docker workers can
use the default prefork pool.

Run a second worker for company career URLs so generic crawls are not blocked
behind ATS or Workday retries:

```powershell
cd D:\Github\Job-portal\backend
.\.venv\Scripts\python.exe -m celery -A celery_app worker --loglevel=info -Q generic --pool=solo --concurrency=1
```

To run all configured sources and career portals immediately:

```powershell
Invoke-WebRequest -Method Post http://127.0.0.1:8000/crawl/all `
  -Headers @{"x-api-key"="your-service-api-key";"Content-Type"="application/json"} `
  -Body "{}"
```

The command queues all ATS configurations and all entries in
`companies/company_urls.yaml`; the worker must be running for jobs to be
crawled and inserted into the portal database.

To crawl every company career URL only, start the API and worker in separate
terminals, then run this Python command from `backend`:

```powershell
.\.venv\Scripts\python.exe -c "from tasks.crawl_tasks import trigger_company_url_crawls; print(trigger_company_url_crawls.delay().id)"
```

The queue progress page is available at `http://localhost:3000/queue`. It
reports each company as queued, running, successful, or failed and refreshes
every five seconds. The current cleaned URL file contains 403 company portals;
the command dispatches every entry in that file.

The frontend's `Generic` source uses `POST /crawl/company-urls`, which reads
only `companies/company_urls.yaml` and sends tasks only to the `generic` queue.
It never loads or dispatches Workday, LinkedIn, or another ATS configuration.

With Docker Compose, `crawler-worker` listens only to ATS/default queues and
`crawler-generic-worker` listens only to `generic`. This keeps Greenhouse or
Workday retries from occupying the company-portal worker.

For a repeatable Windows smoke test:

```powershell
cd D:\Github\Job-portal\backend
.\scripts\verify_pipeline.ps1
```

Use `.\scripts\verify_pipeline.ps1 -All` to queue every configured ATS company
and every generic career portal. The script checks the backend health endpoint,
queues the crawl, waits briefly, and verifies that the portal jobs API is
reachable.

### Inngest versus crawler services

Inngest is used by the frontend for scheduled alert emails only. It is not
required to crawl portals or insert jobs. Crawling requires the backend API,
the Celery worker, Upstash Redis, and the frontend's Neon-backed `/api/jobs`
endpoint.

### Production deployment

Deploy the frontend to Vercel with the variables in `frontend/.env`. Deploy the
backend separately to a persistent Docker host such as Railway, Render, Fly.io,
or a Linux VM; Vercel cannot run Playwright or a Celery worker.

On the Docker host:

```bash
cd backend
docker compose up -d --build
docker compose logs -f crawler-worker
```

Set the backend `PORTAL_API_URL` to the public frontend URL and keep
`PORTAL_API_KEY` equal to the frontend `CRAWLER_API_KEY`. The compose file
mounts both company YAML files, and `all_crawls_dispatched` logs the source
counts. The current configuration has 125 ATS/portal targets and 403 generic
company-career URLs; a full run should report `generic: 403`.

---

## Project Structure

```
crawler/
├── main.py               FastAPI app + scheduler launch
├── config.py             Pydantic settings from .env
├── celery_app.py         Celery broker/backend config
├── models.py             RawJob, NormalizedJob, MatchProfile
├── logging_config.py     Structlog JSON logging
├── profile.yaml          ← EDIT THIS — your job matching rules
│
├── crawlers/
│   ├── base.py           BaseCrawler with timing + error handling
│   ├── workday.py        Workday JSON API (60+ companies)
│   ├── greenhouse.py     Greenhouse REST API (50+ companies)
│   ├── lever.py          Lever JSON API (20+ companies)
│   ├── ashby.py          Ashby REST API (20+ companies)
│   ├── linkedin.py       LinkedIn (Playwright)
│   ├── naukri.py         Naukri (Playwright + Next.js data)
│   └── generic_html.py   Custom career page fallback
│
├── companies/
│   ├── companies.yaml    ← ATS-specific crawler configs
│   ├── company_urls.yaml  ← generic career portal URLs checked every three days
│   └── loader.py         YAML → dict loader
│
├── pipeline/
│   ├── deduplicator.py   Redis SETNX fingerprint dedup
│   ├── normalizer.py     Raw → typed NormalizedJob
│   ├── profile_filter.py Keywords/titles/location/XP filter
│   └── publisher.py      Batched POST to portal API
│
├── tasks/
│   ├── crawl_tasks.py    Celery task definitions
│   └── scheduler.py      APScheduler cron jobs
│
├── monitoring/
│   └── metrics.py        Prometheus counters + histograms
│
├── tests/
│   ├── test_deduplicator.py
│   ├── test_normalizer.py
│   └── test_profile_filter.py
│
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

### Generic company career portals

`companies/company_urls.yaml` contains cleaned `company` and `url` records for
career portals that do not have a dedicated ATS crawler. The scheduler:

- Crawls LinkedIn, all configured ATS work portals, and generic career portals
  Monday-Saturday at 06:00 IST.
- Crawls all generic company career portals every three days.
- Crawls everything, including all ATS sources and generic career portals, every
  Sunday at 06:00 IST.

The generic crawler
discovers same-domain links whose text or path looks like a job listing and
sends them through the normal deduplication, profile filtering, and publishing
pipeline.

Only `fresher` and `junior` (1–3 years) jobs are published. Crawled jobs,
crawl logs, and alert history older than seven days are deleted automatically
each day at 05:30 IST. The company-career jobs are shown separately at
`/company-careers` in the frontend and are limited to the resume-derived
backend, DevOps, security, full-stack, AI, internship, fresher, graduate, and
2027-batch keywords.

---

## Customising Your Profile (profile.yaml)

The profile file is the most important thing to get right.
Edit `profile.yaml` at the root — changes are picked up on the next crawl.

```yaml
keywords:
  - "java"
  - "spring boot"

job_titles:
  - "software engineer"
  - "backend developer"

locations:
  - "bangalore"
  - "remote"

experience_levels:
  - "fresher"
  - "junior"

exclude_keywords:
  - "10+ years"
  - "director"
  - "ios developer"
```

**How the filter works:**
- A job passes if `(any keyword OR any job_title matches)` 
  AND `location matches` AND `experience matches`
- Exclude keywords are checked first — if found, job is dropped immediately
- Leave any list empty `[]` to disable that filter

---

## Adding Companies

Open `companies/companies.yaml` and add under the right ATS type:

```yaml
# Workday — just need tenant name from their URL
workday:
  - company: "New Company"
    tenant: "newcompany"   # from newcompany.wd5.myworkdayjobs.com
    site: "External"

# Greenhouse — just need their board token
greenhouse:
  - company: "New Startup"
    board_token: "newstartup"   # from boards.greenhouse.io/newstartup

# Lever — just need their company slug
lever:
  - company: "New Corp"
    lever_id: "newcorp"   # from jobs.lever.co/newcorp

# Ashby — just need their slug
ashby:
  - company: "New Tool"
    ashby_slug: "newtool"   # from jobs.ashbyhq.com/newtool
```

---

## Adding a New Crawler Source

1. Create `crawlers/my_source.py` extending `BaseCrawler`
2. Implement `async def crawl(self, config: dict) -> list[RawJob]`
3. Add to `CRAWLER_REGISTRY` in `crawlers/__init__.py`
4. Add a section in `companies/companies.yaml`

---

## Monitoring

| URL | What it shows |
|-----|---------------|
| `http://localhost:8000/health` | Service health |
| `http://localhost:8000/metrics` | Prometheus metrics |
| `http://localhost:5555` | Flower — Celery task queue (admin:admin) |

**Key metrics:**
- `crawler_crawls_total{source, status}` — crawl attempts by source and outcome
- `crawler_jobs_published_total{source}` — jobs inserted per source
- `crawler_crawl_duration_seconds{source}` — crawl latency histogram

---

## Running Tests

```bash
# Install test deps
pip install -r requirements.txt

# Run all tests
pytest

# With coverage
pytest --tb=short -v
```

---

## Deployment (Railway / Render / VPS)

```bash
# Build image
docker build -t job-crawler .

# Or use docker-compose (recommended)
docker-compose up -d

# Scale workers if needed
docker-compose up -d --scale crawler-worker=2
```

**Minimum spec:** 1 vCPU, 2 GB RAM (Playwright needs ~500 MB per browser instance)
**Recommended:** 2 vCPU, 4 GB RAM for 4 concurrent workers

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379/0` |
| `PORTAL_API_URL` | Your Next.js job portal URL | — |
| `PORTAL_API_KEY` | API key for portal `/api/jobs` | — |
| `SERVICE_API_KEY` | API key for this service's `/crawl/*` | — |
| `PLAYWRIGHT_HEADLESS` | Run browsers headless | `true` |
| `CRAWL_HOURS` | UTC hours for cron (comma-separated) | `0,6,12,18` |
| `MAX_JOBS_PER_COMPANY` | Safety cap per crawl | `100` |
| `DEDUP_TTL_DAYS` | Days before a job can re-appear | `7` |
