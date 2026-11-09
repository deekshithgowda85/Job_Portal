import Link from "next/link";
import JobCard from "@/components/JobCard";
import { EmptyState, PageHeader, btnSecondary } from "@/components/ui";
import { query } from "@/lib/db";
import type { Job } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saved · JobAlert" };

export default async function SavedPage({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = searchParams.tab === "applied" ? "applied" : "saved";
  const jobs = await query<Job>(
    "SELECT j.*, js.status AS my_status FROM job_status js JOIN jobs j ON j.id = js.job_id WHERE js.status = $1 ORDER BY js.updated_at DESC LIMIT 200",
    [tab],
  );
  const tabCls = (on: boolean) => cn("rounded-lg px-3 py-1.5 text-sm font-medium", on ? "bg-blue-50 text-blue-600" : "text-slate-600");
  return (
    <>
      <PageHeader title="Saved jobs" subtitle="Jobs you saved or marked as applied." />
      <div className="mb-5 flex gap-2">
        <Link href="/saved" className={tabCls(tab === "saved")}>Saved</Link>
        <Link href="/saved?tab=applied" className={tabCls(tab === "applied")}>Applied</Link>
      </div>
      {jobs.length === 0 ? (
        <EmptyState title={tab === "saved" ? "No saved jobs" : "No applied jobs"} hint="Save a job from the job board and it will show up here.">
          <Link href="/jobs" className={btnSecondary}>Browse jobs</Link>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{jobs.map((j) => <JobCard key={j.id} job={j} variant="saved" />)}</div>
      )}
    </>
  );
}
