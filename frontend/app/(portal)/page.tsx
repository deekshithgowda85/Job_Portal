import Link from "next/link";
import { Suspense } from "react";
import JobCard from "@/components/JobCard";
import Pagination from "@/components/Pagination";
import { RunAlerts, RunCrawl } from "@/components/RunButtons";
import { StatRowSkeleton, TableSkeleton } from "@/components/Skeletons";
import { Badge, Card, EmptyState, btnSecondary } from "@/components/ui";
import { query } from "@/lib/db";
import { getDashboardMatches } from "@/lib/matching";
import { getOwner } from "@/lib/owner";
import { getStats } from "@/lib/stats";
import { cap, greeting, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function Stats() {
  const s = await getStats();
  const items = [
    ["Total jobs today", s.jobsToday],
    ["New since yesterday", s.newSinceYesterday],
    ["Your matches (7 days)", s.matches],
    ["Emails sent", s.emailsSent],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map(([label, n]) => (
        <Card key={label} className="p-5"><p className="text-3xl font-semibold">{n.toLocaleString("en-IN")}</p><p className="mt-1 text-slate-500">{label}</p></Card>
      ))}
    </div>
  );
}

async function Matches({ page }: { page: number }) {
  const { jobs, total } = await getDashboardMatches(page, 10);
  if (!jobs.length) return <EmptyState title="No matches yet" hint="Create an alert so new jobs that fit your search show up here."><Link href="/alerts" className={btnSecondary}>Create an alert</Link></EmptyState>;
  return (
    <>
      <Card className="divide-y divide-slate-100">
        {jobs.map((j) => (
          <div key={j.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <Link href={`/jobs/${j.id}`} className="block truncate font-semibold">{j.title}</Link>
              <p className="truncate text-slate-500">{j.company}{j.location ? ` · ${j.location}` : ""}</p>
            </div>
            <Badge tone="blue">{cap(j.source)}</Badge>
            <span className="w-16 text-right text-xs text-slate-500">{timeAgo(j.created_at)}</span>
            <a href={j.url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">Apply</a>
          </div>
        ))}
      </Card>
      <Pagination page={page} total={total} pageSize={10} basePath="/" params={new URLSearchParams()} />
    </>
  );
}

async function CrawlActivity() {
  const rows = await query<{ id: string; source: string; company: string | null; jobs_found: number; jobs_new: number; status: string; error: string | null; ran_at: string }>("SELECT * FROM crawl_logs WHERE status <> 'queued' ORDER BY ran_at DESC LIMIT 10");
  if (!rows.length) return <EmptyState title="No crawls yet" hint="Crawl runs appear here once your crawler service reports to /api/crawl/log." />;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left">
        <thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">{["Source", "Company", "Found", "New", "Status", "Time"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-3">{cap(r.source)}</td>
              <td className="px-4 py-3 text-slate-600">{r.company ?? "-"}</td>
              <td className="px-4 py-3">{r.jobs_found}</td>
              <td className="px-4 py-3">{r.jobs_new}</td>
              <td className="px-4 py-3"><Badge tone={r.status === "success" ? "blue" : "dark"} title={r.error ?? undefined}>{r.status === "success" ? "Success" : "Error"}</Badge></td>
              <td className="px-4 py-3 text-slate-500">{timeAgo(r.ran_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: { page?: string } }) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const [owner, g] = [await getOwner(), greeting()];
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">{g.text}, {owner.name}</h1><p className="mt-1 text-slate-500">{g.date}</p></div>
        <RunAlerts />
      </div>
      <Suspense fallback={<StatRowSkeleton />}><Stats /></Suspense>
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Jobs matching your alerts</h2><Link href="/alerts" className="text-sm font-medium text-blue-600">Manage alerts</Link></div>
        <Suspense key={page} fallback={<TableSkeleton />}><Matches page={page} /></Suspense>
      </section>
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Recent crawl activity</h2><RunCrawl /></div>
        <Suspense fallback={<TableSkeleton rows={4} />}><CrawlActivity /></Suspense>
      </section>
    </div>
  );
}
