import { query } from "@/lib/db";
import type { Facets, FacetItem, Job } from "@/lib/types";
import { DEFAULT_LOCATIONS } from "@/lib/types";

type SP = Record<string, string | string[] | undefined> | URLSearchParams;

export interface JobFilters {
  q: string;
  exclude: string[];
  locations: string[];
  companies: string[];
  sources: string[];
  jobTypes: string[];
  workModes: string[];
  experience: string;
  tags: string[];
  posted: number | null; // hours
  salaryMin: number | null; // LPA
  salaryMax: number | null; // LPA
  hasSalary: boolean;
  status: "all" | "saved" | "applied" | "hide_applied" | "hide_ignored" | "ignored";
  sort: "latest" | "relevance" | "salary";
  page: number;
}

export const PAGE_SIZE = 25;
export const TSV = `to_tsvector('english', j.title || ' ' || COALESCE(j.company, '') || ' ' || COALESCE(j.description, ''))`;
export const FROM = `FROM jobs j LEFT JOIN job_status js ON js.job_id = j.id`;
const ALLOWED_EXPERIENCE = "j.experience_level IN ('fresher', 'junior')";

function all(sp: SP, k: string): string[] {
  if (sp instanceof URLSearchParams) return sp.getAll(k).filter(Boolean);
  const v = sp[k];
  return (v === undefined ? [] : Array.isArray(v) ? v : [v]).filter(Boolean);
}
const one = (sp: SP, k: string) => all(sp, k)[0] ?? "";
const num = (s: string) => (s !== "" && Number.isFinite(Number(s)) ? Number(s) : null);

export function parseFilters(sp: SP): JobFilters {
  const q = one(sp, "q").trim().slice(0, 200);
  const status = one(sp, "status");
  const sort = one(sp, "sort");
  return {
    q,
    exclude: one(sp, "exclude").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 15),
    locations: all(sp, "location"),
    companies: all(sp, "company"),
    sources: all(sp, "source"),
    jobTypes: all(sp, "job_type"),
    workModes: all(sp, "work_mode"),
    experience: ["fresher", "1-3", "3-5", "5+"].includes(one(sp, "experience")) ? one(sp, "experience") : "any",
    tags: all(sp, "tag"),
    posted: [24, 72, 168, 720].includes(Number(one(sp, "posted"))) ? Number(one(sp, "posted")) : null,
    salaryMin: num(one(sp, "salary_min")),
    salaryMax: num(one(sp, "salary_max")),
    hasSalary: one(sp, "has_salary") === "1",
    status: (["all", "saved", "applied", "hide_applied", "hide_ignored", "ignored"].includes(status) ? status : "all") as JobFilters["status"],
    sort: (["latest", "relevance", "salary"].includes(sort) ? sort : q ? "relevance" : "latest") as JobFilters["sort"],
    page: Math.max(1, Math.floor(Number(one(sp, "page"))) || 1),
  };
}

/** Collects WHERE clauses and positional parameters. */
export class Where {
  params: unknown[] = [];
  clauses: string[] = [];
  qIdx: number | null = null;
  p(v: unknown) {
    this.params.push(v);
    return `$${this.params.length}`;
  }
  add(c: string) {
    this.clauses.push(c);
  }
  sql() {
    return this.clauses.length ? `WHERE ${this.clauses.join(" AND ")}` : "";
  }
}

export function toSearchQuery(keywords: string[]): string {
  return keywords.map((k) => k.replace(/"/g, "").trim()).filter(Boolean).map((k) => (/\s/.test(k) ? `"${k}"` : k)).join(" OR ");
}

/** `skip` leaves one filter out; used to compute facet counts. */
export function buildJobWhere(w: Where, f: JobFilters, skip?: string) {
  w.add("j.is_active = true");
  w.add(ALLOWED_EXPERIENCE);
  if (f.q) {
    w.qIdx = w.params.length + 1;
    w.add(`${TSV} @@ websearch_to_tsquery('english', ${w.p(f.q)})`);
  }
  for (const word of f.exclude) w.add(`NOT (${TSV} @@ plainto_tsquery('english', ${w.p(word)}))`);
  if (f.locations.length && skip !== "location") w.add(`j.location ILIKE ANY(${w.p(f.locations.map((l) => `%${l}%`))}::text[])`);
  if (f.companies.length && skip !== "company") w.add(`j.company = ANY(${w.p(f.companies)}::text[])`);
  if (f.sources.length && skip !== "source") w.add(`j.source = ANY(${w.p(f.sources)}::text[])`);
  if (f.jobTypes.length && skip !== "jobType") w.add(`j.job_type = ANY(${w.p(f.jobTypes)}::text[])`);
  if (f.workModes.length && skip !== "workMode") w.add(`j.work_mode = ANY(${w.p(f.workModes)}::text[])`);
  if (f.experience !== "any") {
    const experience = f.experience === "1-3" ? "junior" : f.experience === "3-5" ? "mid" : f.experience === "5+" ? "senior" : f.experience;
    w.add(`j.experience_level = ${w.p(experience)}`);
  }
  if (f.tags.length && skip !== "tag") w.add(`j.tags && ${w.p(f.tags)}::text[]`);
  if (f.posted) w.add(`COALESCE(j.posted_on, j.created_at) >= NOW() - make_interval(hours => ${w.p(f.posted)}::int)`);
  if (f.salaryMin !== null) w.add(`COALESCE(j.salary_max, j.salary_min) >= ${w.p(Math.round(f.salaryMin * 100000))}`);
  if (f.salaryMax !== null) w.add(`COALESCE(j.salary_min, j.salary_max) <= ${w.p(Math.round(f.salaryMax * 100000))}`);
  if (f.hasSalary) w.add("(j.salary_min IS NOT NULL OR j.salary_max IS NOT NULL)");
  switch (f.status) {
    case "saved": w.add("js.status = 'saved'"); break;
    case "applied": w.add("js.status = 'applied'"); break;
    case "ignored": w.add("js.status = 'ignored'"); break;
    case "hide_applied": w.add("COALESCE(js.status, '') NOT IN ('applied', 'ignored')"); break;
    case "hide_ignored": w.add("COALESCE(js.status, '') <> 'ignored'"); break;
  }
}

export async function queryJobs(f: JobFilters): Promise<{ jobs: Job[]; total: number; page: number }> {
  const cw = new Where();
  buildJobWhere(cw, f);
  const rw = new Where();
  buildJobWhere(rw, f);

  const order =
    f.sort === "relevance" && rw.qIdx
      ? `ts_rank(${TSV}, websearch_to_tsquery('english', $${rw.qIdx})) DESC, COALESCE(j.posted_on, j.created_at) DESC`
      : f.sort === "salary"
        ? "COALESCE(j.salary_max, j.salary_min) DESC NULLS LAST, COALESCE(j.posted_on, j.created_at) DESC"
        : "COALESCE(j.posted_on, j.created_at) DESC";

  const limitIdx = rw.p(PAGE_SIZE);
  const offsetIdx = rw.p((f.page - 1) * PAGE_SIZE);

  const countFrom = f.status === "all" ? "FROM jobs j" : FROM;
  const countRows = await query<{ total: number }>(`SELECT COUNT(*)::int AS total ${countFrom} ${cw.sql()}`, cw.params);
  const jobs = await query<Job>(`SELECT j.*, js.status AS my_status ${FROM} ${rw.sql()} ORDER BY ${order} LIMIT ${limitIdx} OFFSET ${offsetIdx}`, rw.params);
  return { jobs, total: countRows[0]?.total ?? 0, page: f.page };
}

async function facetQuery(f: JobFilters, skip: string, select: string, extraFrom = "", limit = 40): Promise<FacetItem[]> {
  const w = new Where();
  buildJobWhere(w, f, skip);
  w.add(`${select} IS NOT NULL`);
  return query<FacetItem>(
    `SELECT ${select} AS value, COUNT(*)::int AS count ${FROM}${extraFrom} ${w.sql()} GROUP BY 1 ORDER BY count DESC, value ASC LIMIT ${limit}`,
    w.params,
  );
}

export async function getFacets(f: JobFilters): Promise<Facets> {
  const [location, company, source, jobType, workMode, tag] = await Promise.all([
    facetQuery(f, "location", "j.location", "", 40),
    facetQuery(f, "company", "j.company", "", 60),
    facetQuery(f, "source", "j.source", "", 10),
    facetQuery(f, "jobType", "j.job_type", "", 10),
    facetQuery(f, "workMode", "j.work_mode", "", 5),
    facetQuery(f, "tag", "t.tag", ", unnest(j.tags) AS t(tag)", 40),
  ]);
  const have = new Set(location.map((l) => l.value.toLowerCase()));
  for (const d of DEFAULT_LOCATIONS) if (!have.has(d.toLowerCase())) location.push({ value: d, count: 0 });
  return { location, company, source, jobType, workMode, tag };
}

/** Rebuilds a query string from filters (used for chips and saved presets). */
export function filtersToParams(f: Partial<JobFilters>): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.exclude?.length) p.set("exclude", f.exclude.join(","));
  f.locations?.forEach((v) => p.append("location", v));
  f.companies?.forEach((v) => p.append("company", v));
  f.sources?.forEach((v) => p.append("source", v));
  f.jobTypes?.forEach((v) => p.append("job_type", v));
  f.workModes?.forEach((v) => p.append("work_mode", v));
  if (f.experience && f.experience !== "any") p.set("experience", f.experience);
  f.tags?.forEach((v) => p.append("tag", v));
  if (f.posted) p.set("posted", String(f.posted));
  if (f.salaryMin !== null && f.salaryMin !== undefined) p.set("salary_min", String(f.salaryMin));
  if (f.salaryMax !== null && f.salaryMax !== undefined) p.set("salary_max", String(f.salaryMax));
  if (f.hasSalary) p.set("has_salary", "1");
  if (f.status && f.status !== "hide_ignored") p.set("status", f.status);
  if (f.sort && f.sort !== "latest") p.set("sort", f.sort);
  return p;
}
