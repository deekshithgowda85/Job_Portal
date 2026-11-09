import { NextResponse } from "next/server";
import { apiError, hasValidApiKey, unauthorized } from "@/lib/api";
import { query } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const queueSchema = z.object({
  run_id: z.string().min(1).max(100),
  source: z.string().min(1).max(50),
  total_tasks: z.number().int().positive(),
});

export async function POST(req: Request) {
  if (!hasValidApiKey(req)) return unauthorized();
  try {
    await query("ALTER TABLE crawl_logs ADD COLUMN IF NOT EXISTS run_id TEXT");
    await query("ALTER TABLE crawl_logs ADD COLUMN IF NOT EXISTS total_tasks INTEGER");
    const body = queueSchema.parse(await req.json());
    await query(
      "INSERT INTO crawl_logs (source, status, total_tasks, run_id) VALUES ($1,'queued',$2,$3)",
      [body.source, body.total_tasks, body.run_id],
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}

export async function GET() {
  try {
    await query("ALTER TABLE crawl_logs ADD COLUMN IF NOT EXISTS run_id TEXT");
    await query("ALTER TABLE crawl_logs ADD COLUMN IF NOT EXISTS task_index INTEGER");
    await query("ALTER TABLE crawl_logs ADD COLUMN IF NOT EXISTS total_tasks INTEGER");
    const [run] = await query<{ run_id: string; source: string; total_tasks: number; ran_at: string }>(
      "SELECT run_id, source, total_tasks, ran_at FROM crawl_logs WHERE status='queued' ORDER BY ran_at DESC LIMIT 1",
    );
    if (!run) return NextResponse.json({ run: null, tasks: [] });
    const tasks = await query<{ status: string; company: string; jobs_found: number; jobs_new: number; error: string | null; duration_ms: number | null; task_index: number; total_tasks: number; ran_at: string }>(
      "SELECT company, status, jobs_found, jobs_new, error, duration_ms, task_index, total_tasks, ran_at FROM crawl_logs WHERE run_id=$1 AND company IS NOT NULL ORDER BY task_index ASC",
      [run.run_id],
    );
    const completed = tasks.filter((task) => ["success", "error"].includes(task.status)).length;
    const running = tasks.filter((task) => task.status === "running").length;
    return NextResponse.json({ run, tasks, completed, running, queued: Math.max(0, run.total_tasks - tasks.length), progress: Math.round((completed / run.total_tasks) * 100) });
  } catch (e) {
    return apiError(e);
  }
}
