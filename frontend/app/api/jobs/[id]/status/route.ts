import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { query } from "@/lib/db";
import { statusSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** Body: { status: "saved" | "applied" | "ignored" | null }. null clears the status. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = z.string().uuid().parse(params.id);
    const { status } = statusSchema.parse(await req.json());
    if (status === null) {
      await query("DELETE FROM job_status WHERE job_id = $1", [id]);
    } else {
      await query(
        `INSERT INTO job_status (job_id, status) VALUES ($1, $2)
         ON CONFLICT (job_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()`,
        [id, status],
      );
    }
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    return apiError(e);
  }
}
