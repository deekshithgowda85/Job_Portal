import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { query } from "@/lib/db";
import { rulePatchSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

async function update(req: Request, params: { id: string }) {
  try {
    const id = z.string().uuid().parse(params.id);
    const data = rulePatchSchema.parse(await req.json());
    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (!entries.length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    // Column names come from the Zod schema keys above, never from raw input.
    const sets = entries.map(([k], i) => `${k} = $${i + 2}`).join(", ");
    const rows = await query(`UPDATE alert_rules SET ${sets} WHERE id = $1 RETURNING *`, [id, ...entries.map(([, v]) => v)]);
    if (!rows.length) return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (e) {
    return apiError(e);
  }
}

export const PUT = (req: Request, { params }: { params: { id: string } }) => update(req, params);
export const PATCH = PUT;

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const id = z.string().uuid().parse(params.id);
    await query("DELETE FROM alert_rules WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
