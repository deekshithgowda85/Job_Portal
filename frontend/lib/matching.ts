import { query } from "@/lib/db";
import { FROM, TSV, Where, toSearchQuery } from "@/lib/filters";
import type { AlertRule, Job } from "@/lib/types";

/** Adds one rule's conditions and returns them as a single parenthesised expression. */
export function ruleCondition(w: Where, rule: AlertRule): string {
  const c: string[] = [];
  const kw = toSearchQuery(rule.keywords);
  if (kw) c.push(`${TSV} @@ websearch_to_tsquery('english', ${w.p(kw)})`);
  for (const word of rule.exclude_keywords) c.push(`NOT (${TSV} @@ plainto_tsquery('english', ${w.p(word)}))`);
  if (rule.locations.length) c.push(`j.location ILIKE ANY(${w.p(rule.locations.map((l) => `%${l}%`))}::text[])`);
  if (rule.companies.length) c.push(`j.company ILIKE ANY(${w.p(rule.companies.map((x) => `%${x}%`))}::text[])`);
  if (rule.job_types.length) c.push(`j.job_type = ANY(${w.p(rule.job_types)}::text[])`);
  if (rule.work_modes.length) c.push(`j.work_mode = ANY(${w.p(rule.work_modes)}::text[])`);
  if (rule.sources.length) c.push(`j.source = ANY(${w.p(rule.sources)}::text[])`);
  if (rule.experience_level && rule.experience_level !== "any") c.push(`j.experience_level = ${w.p(rule.experience_level)}`);
  if (rule.min_salary) c.push(`COALESCE(j.salary_max, j.salary_min) >= ${w.p(rule.min_salary * 100000)}`);
  return c.length ? `(${c.join(" AND ")})` : "(TRUE)";
}

/** Jobs that match one rule, created since `since`, not yet alerted and not ignored. */
export async function getMatchingJobs(rule: AlertRule, since: Date, limit = 50): Promise<Job[]> {
  const w = new Where();
  w.add("j.is_active = true");
  w.add(`j.created_at >= ${w.p(since.toISOString())}`);
  w.add("NOT EXISTS (SELECT 1 FROM alert_log al WHERE al.job_id = j.id)");
  w.add("COALESCE(js.status, '') <> 'ignored'");
  w.add(ruleCondition(w, rule));
  const lim = w.p(limit);
  return query<Job>(`SELECT j.* ${FROM} ${w.sql()} ORDER BY j.created_at DESC LIMIT ${lim}`, w.params);
}

export async function countRuleMatches(rule: AlertRule, days = 14): Promise<number> {
  const w = new Where();
  w.add("j.is_active = true");
  w.add(`j.created_at >= NOW() - make_interval(days => ${w.p(days)}::int)`);
  w.add(ruleCondition(w, rule));
  const rows = await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM jobs j ${w.sql()}`, w.params);
  return rows[0]?.n ?? 0;
}

/** Jobs from the last 7 days matching ANY active rule (dashboard list). */
export async function getDashboardMatches(page: number, pageSize = 10): Promise<{ jobs: Job[]; total: number }> {
  const rules = await query<AlertRule>("SELECT * FROM alert_rules WHERE is_active = true");
  if (!rules.length) return { jobs: [], total: 0 };
  const build = () => {
    const w = new Where();
    w.add("j.is_active = true");
    w.add("j.created_at >= NOW() - INTERVAL '7 days'");
    w.add("COALESCE(js.status, '') NOT IN ('ignored', 'applied')");
    w.add(`(${rules.map((r) => ruleCondition(w, r)).join(" OR ")})`);
    return w;
  };
  const cw = build();
  const rw = build();
  const lim = rw.p(pageSize);
  const off = rw.p((page - 1) * pageSize);
  const [count, jobs] = await Promise.all([
    query<{ n: number }>(`SELECT COUNT(*)::int AS n ${FROM} ${cw.sql()}`, cw.params),
    query<Job>(`SELECT j.*, js.status AS my_status ${FROM} ${rw.sql()} ORDER BY j.created_at DESC LIMIT ${lim} OFFSET ${off}`, rw.params),
  ]);
  return { jobs, total: count[0]?.n ?? 0 };
}
