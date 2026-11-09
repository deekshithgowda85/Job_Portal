"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary, btnSecondary, inputCls } from "@/components/ui";
import { SOURCES } from "@/lib/types";
import { cap } from "@/lib/utils";

export function RunCrawl() {
  const router = useRouter();
  const [source, setSource] = useState<string>(SOURCES[0]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/crawl/trigger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source }) });
      const data = await res.json();
      setMsg(res.ok ? `Crawl started for ${cap(source)}` : data.error ?? "Could not start the crawl");
      if (res.ok) router.refresh();
    } catch {
      setMsg("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={`${inputCls} w-auto`} value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source to crawl">
        {SOURCES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
      </select>
      <button onClick={run} disabled={busy} className={btnSecondary}>{busy ? "Starting" : "Run crawl"}</button>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </div>
  );
}

export function RunAlerts() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function run() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/alerts/trigger", { method: "POST" });
      const data = await res.json();
      setMsg(res.ok ? `Queued ${data.enqueued} alert${data.enqueued === 1 ? "" : "s"}` : data.error ?? "Could not queue alerts");
    } catch {
      setMsg("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={run} disabled={busy} className={btnPrimary}>{busy ? "Queuing" : "Send alerts now"}</button>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </div>
  );
}
