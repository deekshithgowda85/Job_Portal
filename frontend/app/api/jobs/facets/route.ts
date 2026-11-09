import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getFacets, parseFilters } from "@/lib/filters";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    return NextResponse.json(await getFacets(parseFilters(new URL(req.url).searchParams)));
  } catch (e) {
    return apiError(e);
  }
}
