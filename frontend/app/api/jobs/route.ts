import { NextResponse } from "next/server";
import { apiError, hasValidApiKey, makeFingerprint, unauthorized } from "@/lib/api";
import { query } from "@/lib/db";
import { parseFilters, queryJobs } from "@/lib/filters";
import { jobIngestBody } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const filters = parseFilters(new URL(req.url).searchParams);
    return NextResponse.json(await queryJobs(filters));
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  if (!hasValidApiKey(req)) return unauthorized();
  try {
    const jobs = jobIngestBody.parse(await req.json());
    let inserted = 0;
    for (let i = 0; i < jobs.length; i += 20) {
      const results = await Promise.all(
        jobs.slice(i, i + 20).map((j) =>
          query(
            `INSERT INTO jobs (fingerprint, title, company, company_logo, location, work_mode, url, description, source, job_type,
               experience_level, salary_min, salary_max, salary_range, tags, posted_on)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
             ON CONFLICT (fingerprint) DO NOTHING RETURNING id`,
            [
              j.fingerprint ?? makeFingerprint(j.source, j.title, j.company, j.location),
              j.title, j.company, j.company_logo ?? null, j.location ?? null, j.work_mode ?? null, j.url,
              j.description ?? null, j.source, j.job_type ?? null, j.experience_level ?? null,
              j.salary_min ?? null, j.salary_max ?? null, j.salary_range ?? null, j.tags, j.posted_on ?? null,
            ],
          ),
        ),
      );
      inserted += results.filter((r) => r.length > 0).length;
    }
    return NextResponse.json({ inserted, duplicates: jobs.length - inserted });
  } catch (e) {
    return apiError(e);
  }
}
