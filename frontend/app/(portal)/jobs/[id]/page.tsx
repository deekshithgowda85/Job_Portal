import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/JobCard";
import StatusButtons from "@/components/StatusButtons";
import { Badge, Card, btnPrimary } from "@/components/ui";
import { queryOne } from "@/lib/db";
import type { Job } from "@/lib/types";
import { cap, formatSalary, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function JobDetail({ params }: { params: { id: string } }) {
  if (!uuid.test(params.id)) notFound();
  const job = await queryOne<Job>("SELECT j.*, js.status AS my_status FROM jobs j LEFT JOIN job_status js ON js.job_id = j.id WHERE j.id = $1", [params.id]);
  if (!job) notFound();
  const salary = formatSalary(job);
  const meta: [string, string | null][] = [
    ["Source", cap(job.source)], ["Job type", cap(job.job_type)], ["Work mode", cap(job.work_mode)],
    ["Experience", job.experience_level ? cap(job.experience_level) : null], ["Salary", salary],
    ["Posted", timeAgo(job.posted_on ?? job.created_at)],
  ];

  return (
    <>
      <Link href="/jobs" className="mb-4 inline-block text-sm font-medium text-blue-600">Back to jobs</Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{job.title}</h1>
          <p className="mt-1 text-slate-500">{job.company}{job.location ? ` · ${job.location}` : ""}</p>
          {!job.is_active && <div className="mt-3"><Badge tone="dark">No longer active</Badge></div>}
          <Card className="mt-6 p-6">
            <h2 className="mb-3 text-base font-semibold">Job description</h2>
            {job.description ? <p className="whitespace-pre-line leading-relaxed text-slate-700">{job.description}</p> : <p className="text-slate-500">No description was provided. Open the original posting for details.</p>}
          </Card>
        </div>
        <aside className="space-y-4">
          <Card className="space-y-4 p-5">
            <a href={job.url} target="_blank" rel="noopener noreferrer" className={`${btnPrimary} w-full`}>Apply on {cap(job.source)}</a>
            <StatusButtons jobId={job.id} status={job.my_status} full />
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3"><Logo name={job.company} /><div><p className="font-semibold">{job.company}</p>{job.location && <p className="text-slate-500">{job.location}</p>}</div></div>
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Details</h2>
            <dl className="space-y-2">
              {meta.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4"><dt className="text-slate-500">{k}</dt><dd className="text-right text-slate-900">{v}</dd></div>
              ))}
            </dl>
            {job.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{job.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>}
          </Card>
        </aside>
      </div>
    </>
  );
}
