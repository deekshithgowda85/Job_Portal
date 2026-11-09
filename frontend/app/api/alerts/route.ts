import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { query } from "@/lib/db";
import { ruleSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await query("SELECT * FROM alert_rules ORDER BY created_at DESC"));
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const r = ruleSchema.parse(await req.json());
    const [row] = await query(
      `INSERT INTO alert_rules (name, keywords, exclude_keywords, locations, companies, job_types, work_modes,
         experience_level, sources, min_salary, frequency, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [r.name, r.keywords, r.exclude_keywords, r.locations, r.companies, r.job_types, r.work_modes,
       r.experience_level, r.sources, r.min_salary ?? null, r.frequency, r.is_active],
    );
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
