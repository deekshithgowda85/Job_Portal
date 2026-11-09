import { query } from "@/lib/db";
import { getDashboardMatches } from "@/lib/matching";

export interface Stats {
  jobsToday: number;
  newSinceYesterday: number;
  matches: number;
  emailsSent: number;
}

export async function getStats(): Promise<Stats> {
  const [row] = await query<{ today: number; since: number; emails: number }>(`
    SELECT
      (SELECT COUNT(*)::int FROM jobs WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') AS today,
      (SELECT COUNT(*)::int FROM jobs WHERE created_at >= NOW() - INTERVAL '24 hours') AS since,
      (SELECT COUNT(*)::int FROM alert_emails WHERE status = 'delivered') AS emails
  `);
  const { total } = await getDashboardMatches(1, 1);
  return { jobsToday: row?.today ?? 0, newSinceYesterday: row?.since ?? 0, matches: total, emailsSent: row?.emails ?? 0 };
}
