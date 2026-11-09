import { NextResponse } from "next/server";
import { apiError, hasValidApiKey, unauthorized } from "@/lib/api";
import { query } from "@/lib/db";
import { crawlLogSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** The crawler service calls this after each run so crawl activity shows on the dashboard. */
export async function POST(req: Request) {
  if (!hasValidApiKey(req)) return unauthorized();
  try {
    await query("ALTER TABLE crawl_logs ADD COLUMN IF NOT EXISTS run_id TEXT");
    await query("ALTER TABLE crawl_logs ADD COLUMN IF NOT EXISTS task_index INTEGER");
    await query("ALTER TABLE crawl_logs ADD COLUMN IF NOT EXISTS total_tasks INTEGER");
    const l = crawlLogSchema.parse(await req.json());
    if (l.status === "running") {
      await query(
        "INSERT INTO crawl_logs (source, company, status, jobs_found, jobs_new, error, duration_ms, run_id, task_index, total_tasks) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [l.source, l.company ?? null, l.status, l.jobs_found, l.jobs_new, l.error ?? null, l.duration_ms ?? null, l.run_id ?? null, l.task_index ?? null, l.total_tasks ?? null],
      );
    } else {
      await query(
        "UPDATE crawl_logs SET status=$1,jobs_found=$2,jobs_new=$3,error=$4,duration_ms=$5,ran_at=NOW() WHERE run_id=$6 AND company=$7 AND status='running'",
        [l.status, l.jobs_found, l.jobs_new, l.error ?? null, l.duration_ms ?? null, l.run_id ?? null, l.company ?? null],
      );
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
