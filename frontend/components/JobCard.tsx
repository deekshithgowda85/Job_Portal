import Link from "next/link";
import RemoveButton from "@/components/RemoveButton";
import StatusButtons from "@/components/StatusButtons";
import { Badge, Card, btnPrimary, btnSecondary } from "@/components/ui";
import type { Job } from "@/lib/types";
import { cap, formatSalary, timeAgo } from "@/lib/utils";

export const Logo = ({ name }: { name: string }) => (
  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">{name.charAt(0).toUpperCase()}</div>
);

export default function JobCard({ job, variant = "board" }: { job: Job; variant?: "board" | "saved" }) {
  const salary = formatSalary(job);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex gap-3">
        <Logo name={job.company} />
        <div className="min-w-0 flex-1">
          <Link href={`/jobs/${job.id}`} className="line-clamp-2 text-base font-semibold text-slate-900">{job.title}</Link>
          <p className="truncate text-slate-500">{job.company}</p>
        </div>
        <span className="shrink-0 text-xs text-slate-500">{timeAgo(job.posted_on ?? job.created_at)}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {job.location && <Badge>{job.location}</Badge>}
        {job.work_mode && <Badge>{cap(job.work_mode)}</Badge>}
        <Badge tone="blue">{cap(job.source)}</Badge>
        {job.job_type && <Badge>{cap(job.job_type)}</Badge>}
        {salary && <Badge>{salary}</Badge>}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        {variant === "board" ? (
          <>
            <Link href={`/jobs/${job.id}`} className={btnPrimary}>View Job</Link>
            <StatusButtons jobId={job.id} status={job.my_status} />
          </>
        ) : (
          <>
            <a href={job.url} target="_blank" rel="noopener noreferrer" className={btnPrimary}>Apply</a>
            <div className="flex gap-2">
              <Link href={`/jobs/${job.id}`} className={btnSecondary}>Details</Link>
              <RemoveButton jobId={job.id} />
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
