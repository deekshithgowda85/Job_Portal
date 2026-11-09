import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { query } from "@/lib/db";
import { enqueueRules } from "@/lib/queue";

export const dynamic = "force-dynamic";

/** Runs all active alerts now (the scheduled run goes through Inngest at /api/inngest). */
export async function POST() {
  try {
    const rows = await query<{ id: string }>("SELECT id FROM alert_rules WHERE is_active = true");
    const enqueued = await enqueueRules(rows.map((r) => r.id));
    return NextResponse.json({ enqueued });
  } catch (e) {
    return apiError(e);
  }
}
