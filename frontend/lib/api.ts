import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(e: unknown) {
  if (e instanceof ZodError) {
    return NextResponse.json({ error: "Validation failed", issues: e.flatten() }, { status: 400 });
  }
  console.error("[api]", e);
  return NextResponse.json({ error: e instanceof Error ? e.message : "Internal server error" }, { status: 500 });
}

export function hasValidApiKey(req: Request): boolean {
  const expected = process.env.CRAWLER_API_KEY;
  const got = req.headers.get("x-api-key");
  if (!expected || !got) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const unauthorized = () => NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });

export function makeFingerprint(source: string, title: string, company: string, location?: string | null) {
  return createHash("sha256")
    .update([source, title, company, location ?? ""].map((s) => s.trim().toLowerCase()).join("|"))
    .digest("hex");
}
