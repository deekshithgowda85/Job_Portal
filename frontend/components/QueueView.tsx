"use client";

import { useEffect, useState } from "react";
import { Badge, Card, EmptyState } from "@/components/ui";

type QueueData = { run: { source: string; total_tasks: number; ran_at: string } | null; tasks: Array<{ company: string; status: string; jobs_found: number; jobs_new: number; error: string | null }>; completed: number; running: number; queued: number; progress: number };

export default function QueueView() {
  const [data, setData] = useState<QueueData | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const response = await fetch("/api/crawl/queue", { cache: "no-store" });
      if (response.ok && active) setData(await response.json());
    };
    load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  if (!data?.run) return <EmptyState title="No crawl is queued" hint="Start a company-career crawl to see its progress here." />;
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap justify-between gap-3"><div><p className="text-sm text-slate-500">Source</p><p className="font-semibold">{data.run.source}</p></div><div><p className="text-sm text-slate-500">Progress</p><p className="text-2xl font-semibold">{data.progress}%</p></div><div><p className="text-sm text-slate-500">Completed / total</p><p className="font-semibold">{data.completed} / {data.run.total_tasks}</p></div></div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-600 transition-all" style={{ width: `${data.progress}%` }} /></div>
        <p className="mt-2 text-sm text-slate-500">{data.running} running · {data.queued} queued</p>
      </Card>
      <Card className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-slate-100 text-xs uppercase text-slate-500"><th className="px-4 py-3">Company</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Found</th><th className="px-4 py-3">New</th></tr></thead><tbody>{data.tasks.map((task) => <tr key={task.company} className="border-b border-slate-100"><td className="px-4 py-3">{task.company}</td><td className="px-4 py-3"><Badge tone={task.status === "success" ? "blue" : task.status === "running" ? "gray" : "dark"}>{task.status}</Badge></td><td className="px-4 py-3">{task.jobs_found}</td><td className="px-4 py-3">{task.jobs_new}</td></tr>)}</tbody></table></Card>
    </div>
  );
}
