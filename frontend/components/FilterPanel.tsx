"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUrlFilters } from "@/components/useUrlFilters";
import { btnSecondary, inputCls } from "@/components/ui";
import { EXPERIENCE, type FacetItem, type Facets } from "@/lib/types";
import { cap, cn } from "@/lib/utils";

interface Preset { id: string; name: string; query_string: string }

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group border-b border-slate-100 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-900">
        {title}
        <span className="text-slate-400 group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-3 space-y-2">{children}</div>
    </details>
  );
}

function CheckGroup({ param, items, selected, onToggle, searchable = false, limit = 8, format = (v: string) => v }: {
  param: string; items: FacetItem[]; selected: string[]; onToggle: (k: string, v: string) => void; searchable?: boolean; limit?: number; format?: (v: string) => string;
}) {
  const [term, setTerm] = useState("");
  const [all, setAll] = useState(false);
  const known = new Set(items.map((i) => i.value));
  const merged = [...selected.filter((s) => !known.has(s)).map((value) => ({ value, count: 0 })), ...items];
  const filtered = merged.filter((i) => i.value.toLowerCase().includes(term.toLowerCase()));
  const shown = all || term ? filtered : filtered.slice(0, limit);
  return (
    <>
      {searchable && <input className={inputCls} placeholder="Search..." value={term} onChange={(e) => setTerm(e.target.value)} aria-label={`Search ${param}`} />}
      {shown.length === 0 && <p className="text-xs text-slate-500">No options</p>}
      {shown.map((i) => (
        <label key={i.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-blue-600" checked={selected.includes(i.value)} onChange={() => onToggle(param, i.value)} />
          <span className="min-w-0 flex-1 truncate">{format(i.value)}</span>
          <span className="text-xs text-slate-400">{i.count}</span>
        </label>
      ))}
      {!term && filtered.length > limit && (
        <button type="button" onClick={() => setAll((a) => !a)} className="text-xs font-medium text-blue-600">
          {all ? "Show less" : `Show ${filtered.length - limit} more`}
        </button>
      )}
    </>
  );
}

function useDebounced(onCommit: (v: string) => void, current: string) {
  const [value, setValue] = useState(current);
  const committed = useRef(current);
  // Sync from the URL only when it changed from outside (e.g. "Clear all"), never mid-typing.
  useEffect(() => {
    if (current !== committed.current) {
      committed.current = current;
      setValue(current);
    }
  }, [current]);
  useEffect(() => {
    const next = value.trim();
    if (next === committed.current) return;
    const t = setTimeout(() => {
      committed.current = next;
      onCommit(next);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return [value, setValue] as const;
}

export default function FilterPanel({ facets, presets }: { facets: Facets; presets: Preset[] }) {
  const { sp, pending, set, toggle, clearAll } = useUrlFilters();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const get = (k: string) => sp.getAll(k);

  const [q, setQ] = useDebounced((v) => set("q", v), sp.get("q") ?? "");
  const [exclude, setExclude] = useDebounced((v) => set("exclude", v), sp.get("exclude") ?? "");
  const [sMin, setSMin] = useDebounced((v) => set("salary_min", v), sp.get("salary_min") ?? "");
  const [sMax, setSMax] = useDebounced((v) => set("salary_max", v), sp.get("salary_max") ?? "");

  const posted = sp.get("posted") ?? "";
  const experience = sp.get("experience") ?? "any";
  const status = sp.get("status") ?? "all";
  const hasFilters = Array.from(sp.keys()).some((k) => k !== "sort" && k !== "page");

  async function savePreset() {
    const name = window.prompt("Name this filter");
    if (!name?.trim()) return;
    const n = new URLSearchParams(sp.toString());
    n.delete("page");
    await fetch("/api/filters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), query_string: n.toString() }) });
    router.refresh();
  }
  async function deletePreset(id: string) {
    await fetch(`/api/filters/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className={cn(pending && "opacity-70 transition-opacity")}>
      <button type="button" onClick={() => setOpen(true)} className={cn(btnSecondary, "mb-4 w-full lg:hidden")}>Filters{hasFilters ? " (active)" : ""}</button>
      <div className={cn(open ? "fixed inset-0 z-40 overflow-y-auto bg-white p-4" : "hidden", "lg:static lg:z-auto lg:block lg:overflow-visible lg:p-0")}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Filters</h2>
          <div className="flex items-center gap-3">
            {hasFilters && <button type="button" onClick={clearAll} className="text-sm font-medium text-blue-600">Clear all</button>}
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-600 lg:hidden">Done</button>
          </div>
        </div>

        <div className="space-y-2 border-b border-slate-100 pb-4">
          <input className={inputCls} placeholder='Search jobs, e.g. "spring boot" java' value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search jobs" />
          <input className={inputCls} placeholder="Exclude words: senior, manager" value={exclude} onChange={(e) => setExclude(e.target.value)} aria-label="Exclude keywords" />
          <div className="flex gap-2 pt-1">
            <select className={cn(inputCls, "text-xs")} value={presets.find((p) => p.query_string === sp.toString())?.id ?? ""} onChange={(e) => { const p = presets.find((x) => x.id === e.target.value); if (p) router.replace(`/jobs?${p.query_string}`); }} aria-label="Saved filters">
              <option value="">Saved filters</option>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" onClick={savePreset} className={cn(btnSecondary, "shrink-0 px-3 text-xs")}>Save</button>
          </div>
          {presets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {p.name}
                  <button type="button" aria-label={`Delete ${p.name}`} onClick={() => deletePreset(p.id)} className="text-slate-400 hover:text-slate-700">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <Section title="Posted">
          {[["", "Any time"], ["24", "Last 24 hours"], ["72", "Last 3 days"], ["168", "Last 7 days"], ["720", "Last 30 days"]].map(([v, label]) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="posted" className="h-4 w-4 accent-blue-600" checked={posted === v} onChange={() => set("posted", v || null)} />{label}
            </label>
          ))}
        </Section>

        <Section title="Location"><CheckGroup param="location" items={facets.location} selected={get("location")} onToggle={toggle} searchable /></Section>
        <Section title="Work mode"><CheckGroup param="work_mode" items={facets.workMode} selected={get("work_mode")} onToggle={toggle} format={cap} /></Section>
        <Section title="Job type"><CheckGroup param="job_type" items={facets.jobType} selected={get("job_type")} onToggle={toggle} format={cap} /></Section>

        <Section title="Experience">
          {EXPERIENCE.map((e) => (
            <label key={e.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="experience" className="h-4 w-4 accent-blue-600" checked={experience === e.value} onChange={() => set("experience", e.value === "any" ? null : e.value)} />{e.label}
            </label>
          ))}
        </Section>

        <Section title="Salary (LPA)">
          <div className="flex items-center gap-2">
            <input type="number" min={0} className={inputCls} placeholder="Min" value={sMin} onChange={(e) => setSMin(e.target.value)} aria-label="Minimum salary in LPA" />
            <span className="text-slate-400">to</span>
            <input type="number" min={0} className={inputCls} placeholder="Max" value={sMax} onChange={(e) => setSMax(e.target.value)} aria-label="Maximum salary in LPA" />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-blue-600" checked={sp.get("has_salary") === "1"} onChange={(e) => set("has_salary", e.target.checked ? "1" : null)} />
            Only jobs that show salary
          </label>
        </Section>

        <Section title="Source"><CheckGroup param="source" items={facets.source} selected={get("source")} onToggle={toggle} format={cap} /></Section>
        <Section title="Company"><CheckGroup param="company" items={facets.company} selected={get("company")} onToggle={toggle} searchable /></Section>
        <Section title="Skills" defaultOpen={false}><CheckGroup param="tag" items={facets.tag} selected={get("tag")} onToggle={toggle} searchable /></Section>

        <Section title="My jobs">
          {[["hide_ignored", "Hide ignored"], ["hide_applied", "Hide applied and ignored"], ["all", "Show everything"], ["saved", "Only saved"], ["applied", "Only applied"], ["ignored", "Only ignored"]].map(([v, label]) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="status" className="h-4 w-4 accent-blue-600" checked={status === v} onChange={() => set("status", v === "hide_ignored" ? null : v)} />{label}
            </label>
          ))}
        </Section>
      </div>
    </div>
  );
}
