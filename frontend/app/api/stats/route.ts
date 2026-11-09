import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getStats());
  } catch (e) {
    return apiError(e);
  }
}
