import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const id = z.string().uuid().parse(params.id);
    const job = await queryOne("SELECT j.*, js.status AS my_status FROM jobs j LEFT JOIN job_status js ON js.job_id = j.id WHERE j.id = $1", [id]);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json(job);
  } catch (e) {
    return apiError(e);
  }
}
