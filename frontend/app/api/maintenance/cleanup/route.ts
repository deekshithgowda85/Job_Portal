import { NextResponse } from "next/server";
import { apiError, hasValidApiKey, unauthorized } from "@/lib/api";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!hasValidApiKey(req)) return unauthorized();

  try {
    const body = await req.json().catch(() => ({}));
    const retentionDays = Number(body.retention_days ?? 7);
    if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 31) {
      return NextResponse.json({ error: "retention_days must be an integer from 1 to 31" }, { status: 400 });
    }

    const jobs = await query<{ id: string }>(
      "DELETE FROM jobs WHERE created_at < NOW() - make_interval(days => $1::int) RETURNING id",
      [retentionDays],
    );
    const ineligibleJobs = await query<{ id: string }>(
      "DELETE FROM jobs WHERE experience_level NOT IN ('fresher', 'junior') OR experience_level IS NULL RETURNING id",
    );
    const crawlLogs = await query<{ id: string }>(
      "DELETE FROM crawl_logs WHERE ran_at < NOW() - make_interval(days => $1::int) RETURNING id",
      [retentionDays],
    );
    const alertHistory = await query<{ id: string }>(
      "DELETE FROM alert_emails WHERE sent_at < NOW() - make_interval(days => $1::int) RETURNING id",
      [retentionDays],
    );

    return NextResponse.json({
      deleted_jobs: jobs.length,
      deleted_ineligible_jobs: ineligibleJobs.length,
      deleted_crawl_logs: crawlLogs.length,
      deleted_alert_history: alertHistory.length,
    });
  } catch (e) {
    return apiError(e);
  }
}
