import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { countRuleMatches } from "@/lib/matching";
import { ruleSchema } from "@/lib/schemas";
import type { AlertRule } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const r = ruleSchema.parse(await req.json());
    const rule = { ...r, id: "preview", min_salary: r.min_salary ?? null, created_at: "" } as AlertRule;
    return NextResponse.json({ matches: await countRuleMatches(rule, 14) });
  } catch (e) {
    return apiError(e);
  }
}
