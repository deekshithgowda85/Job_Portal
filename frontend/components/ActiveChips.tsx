"use client";

import { useUrlFilters } from "@/components/useUrlFilters";
import { cap } from "@/lib/utils";

const LABELS: Record<string, string> = { location: "Location", company: "Company", source: "Source", job_type: "Type", work_mode: "Mode", tag: "Skill" };
const POSTED: Record<string, string> = { "24": "Last 24 hours", "72": "Last 3 days", "168": "Last 7 days", "720": "Last 30 days" };
const STATUS: Record<string, string> = { all: "All jobs", saved: "Only saved", applied: "Only applied", hide_applied: "Hide applied", ignored: "Only ignored" };

export default function ActiveChips() {
  const { sp, push, clearAll } = useUrlFilters();
  const chips: { key: string; value: string | null; label: string }[] = [];

  sp.forEach((value, key) => {
    if (key === "page" || key === "sort") return;
    if (key in LABELS) chips.push({ key, value, label: `${LABELS[key]}: ${["source", "job_type", "work_mode"].includes(key) ? cap(value) : value}` });
    else if (key === "q") chips.push({ key, value: null, label: `Search: ${value}` });
    else if (key === "exclude") chips.push({ key, value: null, label: `Exclude: ${value}` });
    else if (key === "experience") chips.push({ key, value: null, label: `Experience: ${value}` });
    else if (key === "posted") chips.push({ key, value: null, label: POSTED[value] ?? value });
    else if (key === "salary_min") chips.push({ key, value: null, label: `Min ${value} LPA` });
    else if (key === "salary_max") chips.push({ key, value: null, label: `Max ${value} LPA` });
    else if (key === "has_salary") chips.push({ key, value: null, label: "Salary shown" });
    else if (key === "status") chips.push({ key, value: null, label: STATUS[value] ?? value });
  });
  if (!chips.length) return null;

  function remove(c: { key: string; value: string | null }) {
    const n = new URLSearchParams();
    let removed = false;
    sp.forEach((v, k) => {
      if (!removed && k === c.key && (c.value === null || v === c.value)) {
        removed = true;
        return;
      }
      n.append(k, v);
    });
    push(n);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((c, i) => (
        <span key={`${c.key}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
          {c.label}
          <button type="button" aria-label={`Remove ${c.label}`} onClick={() => remove(c)} className="text-slate-400 hover:text-slate-700">×</button>
        </span>
      ))}
      <button type="button" onClick={clearAll} className="text-xs font-medium text-blue-600">Clear all</button>
    </div>
  );
}
