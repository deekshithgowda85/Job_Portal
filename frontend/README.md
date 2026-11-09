# JobAlert: personal job alert portal

A single-user Next.js 14 app. It collects jobs from your crawler service, lets you filter them properly, and emails you when new jobs match your alerts. There is no sign in and no admin area, because it is built for one person.

## Features

- Job board with URL-based filters: keyword search (phrases and `-exclude`), exclude words, posted date, location, work mode, job type, experience, salary range, source, company, skills, and your own status (saved, applied, ignored). Facet counts update as you filter. Saved filter presets and removable filter chips.
- Alert rules with daily, weekly or instant email.
- Save, apply and ignore jobs. Ignored jobs are hidden by default and never emailed.
- Dashboard with stats, your matches, and crawl activity.

## Architecture

```
  Crawler service ──POST /api/jobs (x-api-key)──┐
        ▲                                        ▼
        │ POST /crawl              ┌───────────────────────┐
        │                          │  Next.js 14 (Vercel)  │──► Neon Postgres
  "Run crawl" button ─────────────►│  pages + API routes   │      jobs, alert_rules,
                                   └──────────┬────────────┘      job_status, alert_log...
                                              │
   Inngest cron (7 AM IST daily, Mon weekly,  │ /api/inngest
   every 15 min for instant)  ────────────────┘
                                              │ enqueue one job per rule
                                              ▼
                                   Upstash Redis (BullMQ queue)
                                              │
                                              ▼
                              Worker process (npm run worker)
                              match jobs ─► Resend email ─► alert_log + alert_emails
```

The BullMQ worker is a long-running process, so it cannot run inside Vercel functions. Run it on your laptop while testing, or on a small host (Railway, Render, Fly.io) in production.

## Setup (Windows PowerShell)

```powershell
# 1. Install dependencies
npm install

# 2. Create your env file and fill it in
Copy-Item .env.local.example .env
notepad .env

# 3. Create the tables and save your name and email
npm run db:setup

# 4. Optional: add 60 sample jobs so the filters have data to play with
npm run db:sample

# 5. Start the app
npm run dev

# 6. In a second terminal, start the email worker
npm run worker
```

Open http://localhost:3000.

## Environment variables

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `OWNER_NAME`, `OWNER_EMAIL` | Your name for the greeting, and where alerts are sent |
| `NEXT_PUBLIC_APP_URL` | Public URL of the app, used in email links |
| `RESEND_API_KEY`, `RESEND_FROM` | Resend key and the sender address |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash REST credentials |
| `REDIS_URL` | Upstash TCP URL (`rediss://...`). BullMQ needs this one |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | From the Inngest dashboard |
| `CRAWLER_API_KEY` | Shared secret between this app and your crawler |
| `CRAWLER_SERVICE_URL` | Base URL of your crawler service |

## Crawler contract

Send jobs to the portal:

```http
POST /api/jobs
x-api-key: <CRAWLER_API_KEY>

[{ "title": "Java Developer", "company": "Acme", "url": "https://...", "source": "linkedin",
   "location": "Bangalore", "work_mode": "hybrid", "job_type": "full-time", "experience_level": "1-3",
   "salary_min": 800000, "salary_max": 1200000, "tags": ["Java", "Spring Boot"],
   "posted_on": "2026-11-09T05:00:00Z" }]
```

Response: `{ "inserted": 12, "duplicates": 3 }`. Duplicates are detected by a fingerprint (hash of source, title, company and location); you can also send your own `fingerprint`. Salaries are yearly amounts in INR.

After each run, report it so the dashboard shows crawl activity:

```http
POST /api/crawl/log
x-api-key: <CRAWLER_API_KEY>

{ "source": "linkedin", "company": "Acme", "status": "success", "jobs_found": 40, "jobs_new": 12, "duration_ms": 8200 }
```

The "Run crawl" button on the dashboard calls `POST {CRAWLER_SERVICE_URL}/crawl` with `{ "source": "linkedin" }` and the same API key header.

## Deploy to Vercel

1. Push the project to GitHub and import it in Vercel. Add every variable from `.env.local.example`.
2. In Inngest, sync the app at `https://your-app.vercel.app/api/inngest`.
3. Deploy the worker (`npm run worker`) to a host that keeps processes running, with the same env vars.
4. **Protect the site.** There is no login, so anyone with the URL could see and change your data. Turn on Vercel Deployment Protection (Password Protection or Vercel Authentication) in the project settings.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app |
| `npm run db:setup` | Create tables, save owner |
| `npm run db:sample` | Same, plus 60 sample jobs |
| `npm run worker` | Process alert emails |
| `npm run typecheck` | Type-check the project |
