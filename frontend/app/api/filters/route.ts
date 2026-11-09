import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { query } from "@/lib/db";
import { filterPresetSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await query("SELECT * FROM saved_filters ORDER BY created_at DESC"));
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const { name, query_string } = filterPresetSchema.parse(await req.json());
    const [row] = await query("INSERT INTO saved_filters (name, query_string) VALUES ($1, $2) RETURNING *", [name, query_string]);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
