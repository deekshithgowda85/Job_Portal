CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  owner_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  exclude_keywords TEXT[] DEFAULT '{}',
  locations TEXT[] DEFAULT '{}',
  companies TEXT[] DEFAULT '{}',
  job_types TEXT[] DEFAULT '{}',
  work_modes TEXT[] DEFAULT '{}',
  experience_level TEXT DEFAULT 'any',
  sources TEXT[] DEFAULT '{}',
  min_salary INTEGER,
  frequency TEXT DEFAULT 'daily',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fingerprint TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  company_logo TEXT,
  location TEXT,
  work_mode TEXT,
  url TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL,
  job_type TEXT,
  experience_level TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  salary_range TEXT,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  posted_on TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_fts ON jobs USING GIN (
  to_tsvector('english', title || ' ' || COALESCE(company, '') || ' ' || COALESCE(description, ''))
);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_posted ON jobs (posted_on DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs (source);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs (company);
CREATE INDEX IF NOT EXISTS idx_jobs_active ON jobs (is_active);
CREATE INDEX IF NOT EXISTS idx_jobs_tags ON jobs USING GIN (tags);

CREATE TABLE IF NOT EXISTS job_status (
  job_id UUID PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('saved','applied','ignored')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_filters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  query_string TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  channel TEXT DEFAULT 'email',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id)
);

CREATE TABLE IF NOT EXISTS alert_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
  rule_name TEXT,
  job_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'delivered',
  error TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crawl_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,
  company TEXT,
  status TEXT,
  jobs_found INTEGER DEFAULT 0,
  jobs_new INTEGER DEFAULT 0,
  error TEXT,
  duration_ms INTEGER,
  run_id TEXT,
  task_index INTEGER,
  total_tasks INTEGER,
  ran_at TIMESTAMPTZ DEFAULT NOW()
);
