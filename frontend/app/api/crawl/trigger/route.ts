import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { crawlTriggerSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { source } = crawlTriggerSchema.parse(await req.json());
    const base = process.env.CRAWLER_SERVICE_URL;
    if (!base) return NextResponse.json({ error: "CRAWLER_SERVICE_URL is not set" }, { status: 503 });
    const endpoint = source === "generic" ? "/crawl/company-urls" : "/crawl/all";
    const res = await fetch(`${base.replace(/\/$/, "")}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.CRAWLER_API_KEY ?? "" },
      body: source === "generic" ? undefined : JSON.stringify({ source }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: `Crawler responded with ${res.status}`, detail: detail.slice(0, 500) },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, source });
  } catch (e) {
    return apiError(e);
  }
}
