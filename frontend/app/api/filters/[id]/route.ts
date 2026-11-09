import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    await query("DELETE FROM saved_filters WHERE id = $1", [z.string().uuid().parse(params.id)]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
