"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";

type Status = "saved" | "applied" | "ignored" | null | undefined;

export default function StatusButtons({ jobId, status, full = false }: { jobId: string; status: Status; full?: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState<Status>(status);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  async function set(next: "saved" | "applied" | "ignored") {
    const value = current === next ? null : next;
    const previous = current;
    setCurrent(value);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${jobId}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: value }) });
      if (!res.ok) throw new Error();
      start(() => router.refresh());
    } catch {
      setCurrent(previous);
      setError("Could not update. Try again.");
    }
  }

  const cls = (on: boolean) =>
    cn("rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50", on ? "border-blue-600 bg-blue-50 text-blue-600" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button disabled={pending} onClick={() => set("saved")} className={cls(current === "saved")}>{current === "saved" ? "Saved" : "Save"}</button>
      {full && <button disabled={pending} onClick={() => set("applied")} className={cls(current === "applied")}>{current === "applied" ? "Applied" : "Mark as applied"}</button>}
      <button disabled={pending} onClick={() => set("ignored")} className={cls(current === "ignored")}>{current === "ignored" ? "Ignored" : "Ignore"}</button>
      {error && <span className="text-xs text-slate-500">{error}</span>}
    </div>
  );
}
