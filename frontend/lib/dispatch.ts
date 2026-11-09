import { query, queryOne } from "@/lib/db";
import { sendAlertEmail } from "@/lib/email";
import { getMatchingJobs } from "@/lib/matching";
import { getOwner } from "@/lib/owner";
import type { AlertRule } from "@/lib/types";

const LOOKBACK_MS: Record<string, number> = {
  instant: 2 * 3600_000,
  daily: 48 * 3600_000,
  weekly: 8 * 24 * 3600_000,
};

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

export async function loadRuleIds(frequency: string): Promise<string[]> {
  const rows = await query<{ id: string }>("SELECT id FROM alert_rules WHERE is_active = true AND frequency = $1", [frequency]);
  return rows.map((r) => r.id);
}

/** Finds new matches for one rule, emails the owner, and records what was sent. */
export async function processRule(ruleId: string): Promise<{ sent: number }> {
  const rule = await queryOne<AlertRule>("SELECT * FROM alert_rules WHERE id = $1", [ruleId]);
  if (!rule || !rule.is_active) return { sent: 0 };

  const since = new Date(Date.now() - (LOOKBACK_MS[rule.frequency] ?? LOOKBACK_MS.daily));
  const jobs = await getMatchingJobs(rule, since, 50);
  if (!jobs.length) return { sent: 0 };

  const owner = await getOwner();
  const shown = jobs.slice(0, 20);
  try {
    await sendAlertEmail(owner.email, {
      name: owner.name,
      ruleName: rule.name,
      jobs: shown.map((j) => ({ id: j.id, title: j.title, company: j.company, location: j.location, source: j.source, url: j.url })),
      totalMatches: jobs.length,
      viewAllUrl: `${appUrl()}/`,
      manageUrl: `${appUrl()}/alerts`,
    });
  } catch (e) {
    await query("INSERT INTO alert_emails (rule_id, rule_name, job_count, status, error) VALUES ($1, $2, $3, 'failed', $4)", [
      rule.id,
      rule.name,
      shown.length,
      e instanceof Error ? e.message : String(e),
    ]);
    throw e;
  }
  await query("INSERT INTO alert_log (rule_id, job_id) SELECT $1, UNNEST($2::uuid[]) ON CONFLICT DO NOTHING", [rule.id, shown.map((j) => j.id)]);
  await query("INSERT INTO alert_emails (rule_id, rule_name, job_count, status) VALUES ($1, $2, $3, 'delivered')", [rule.id, rule.name, shown.length]);
  return { sent: shown.length };
}
