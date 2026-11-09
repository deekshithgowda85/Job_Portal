"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import TagInput from "@/components/TagInput";
import { Badge, Card, EmptyState, btnPrimary, btnSecondary, inputCls } from "@/components/ui";
import { DEFAULT_LOCATIONS, EXPERIENCE, JOB_TYPES, SOURCES, WORK_MODES, type AlertRule } from "@/lib/types";
import { cap } from "@/lib/utils";

type Form = Omit<AlertRule, "id" | "created_at">;
const blank: Form = { name: "", keywords: [], exclude_keywords: [], locations: [], companies: [], job_types: [], work_modes: [], experience_level: "any", sources: [], min_salary: null, frequency: "daily", is_active: true };

function CheckList<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {options.map((o) => (
        <label key={o} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-blue-600" checked={value.includes(o)} onChange={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])} />
          {cap(o)}
        </label>
      ))}
    </div>
  );
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5"><label className="text-sm font-medium text-slate-900">{label}</label>{children}{hint && <p className="text-xs text-slate-500">{hint}</p>}</div>
);

function RuleForm({ initial, id, onClose }: { initial: Form; id?: string; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string>("");
  const up = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  async function call(url: string, method: string) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const issue = data?.issues?.fieldErrors ? Object.values(data.issues.fieldErrors as Record<string, string[]>).flat()[0] : null;
      throw new Error(issue ?? data.error ?? "Something went wrong");
    }
    return data;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return setError("Give the alert a name");
    setBusy(true);
    setError("");
    try {
      await call(id ? `/api/alerts/${id}` : "/api/alerts", id ? "PUT" : "POST");
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function runPreview() {
    setPreview("Checking...");
    try {
      const d = await call("/api/alerts/preview", "POST");
      setPreview(`${d.matches} job${d.matches === 1 ? "" : "s"} from the last 14 days match`);
    } catch (err) {
      setPreview(err instanceof Error ? err.message : "Could not check matches");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/30 p-4" role="dialog" aria-modal="true">
      <form onSubmit={save} className="my-8 w-full max-w-2xl space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{id ? "Edit alert" : "Create alert"}</h2><button type="button" onClick={onClose} className="text-slate-500">Close</button></div>
        <Field label="Alert name"><input className={inputCls} value={f.name} onChange={(e) => up("name", e.target.value)} placeholder="Java backend, Bangalore" maxLength={80} /></Field>
        <Field label="Keywords" hint="Press Enter or comma to add. A job matches if it has any keyword. Multi-word keywords are matched as phrases."><TagInput tone="blue" value={f.keywords} onChange={(v) => up("keywords", v)} placeholder="java, spring boot, react" /></Field>
        <Field label="Exclude keywords"><TagInput value={f.exclude_keywords} onChange={(v) => up("exclude_keywords", v)} placeholder="senior, manager" /></Field>
        <Field label="Locations"><TagInput value={f.locations} onChange={(v) => up("locations", v)} placeholder="Add a city" suggestions={DEFAULT_LOCATIONS} /></Field>
        <Field label="Companies (optional)"><TagInput value={f.companies} onChange={(v) => up("companies", v)} placeholder="Google, Atlassian" /></Field>
        <Field label="Job type"><CheckList options={JOB_TYPES} value={f.job_types as never} onChange={(v) => up("job_types", v)} /></Field>
        <Field label="Work mode"><CheckList options={WORK_MODES} value={f.work_modes as never} onChange={(v) => up("work_modes", v)} /></Field>
        <Field label="Experience level">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {EXPERIENCE.map((e) => (
              <label key={e.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="radio" name="exp" className="h-4 w-4 accent-blue-600" checked={f.experience_level === e.value} onChange={() => up("experience_level", e.value)} />{e.label}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Sources"><CheckList options={SOURCES} value={f.sources as never} onChange={(v) => up("sources", v)} /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Minimum salary (LPA)"><input type="number" min={0} className={inputCls} value={f.min_salary ?? ""} onChange={(e) => up("min_salary", e.target.value === "" ? null : Number(e.target.value))} /></Field>
          <Field label="Frequency">
            <select className={inputCls} value={f.frequency} onChange={(e) => up("frequency", e.target.value as Form["frequency"])}>
              <option value="daily">Daily digest</option><option value="instant">Instant</option><option value="weekly">Weekly</option>
            </select>
          </Field>
        </div>
        {error && <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-900" role="alert">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-3"><button type="button" onClick={runPreview} className={btnSecondary}>Preview matches</button><span className="text-xs text-slate-500">{preview}</span></div>
          <div className="flex gap-2"><button type="button" onClick={onClose} className={btnSecondary}>Cancel</button><button type="submit" disabled={busy} className={btnPrimary}>{busy ? "Saving" : "Save alert"}</button></div>
        </div>
      </form>
    </div>
  );
}

export default function AlertsManager({ rules }: { rules: AlertRule[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AlertRule | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(r: AlertRule) {
    setBusyId(r.id);
    await fetch(`/api/alerts/${r.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: !r.is_active }) });
    setBusyId(null);
    router.refresh();
  }
  async function remove(r: AlertRule) {
    if (!window.confirm(`Delete "${r.name}"?`)) return;
    setBusyId(r.id);
    await fetch(`/api/alerts/${r.id}`, { method: "DELETE" });
    setBusyId(null);
    router.refresh();
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Your alert subscriptions</h1><p className="mt-1 text-slate-500">New jobs that match an alert are emailed to you.</p></div>
        <button onClick={() => setEditing("new")} className={btnPrimary}>Create alert</button>
      </div>
      {rules.length === 0 ? (
        <EmptyState title="No alerts yet" hint="Add keywords and locations and you will get an email when matching jobs appear."><button onClick={() => setEditing("new")} className={btnPrimary}>Create your first alert</button></EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rules.map((r) => (
            <Card key={r.id} className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><h2 className="truncate text-base font-semibold">{r.name}</h2><div className="mt-1 flex flex-wrap gap-2"><Badge>{cap(r.frequency)}</Badge><Badge tone={r.is_active ? "blue" : "gray"}>{r.is_active ? "Active" : "Paused"}</Badge></div></div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" role="switch" className="h-4 w-4 accent-blue-600" checked={r.is_active} disabled={busyId === r.id} onChange={() => toggle(r)} />
                  {r.is_active ? "On" : "Off"}
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {r.keywords.map((k) => <Badge key={k} tone="blue">{k}</Badge>)}
                {r.locations.map((l) => <Badge key={l}>{l}</Badge>)}
                {r.companies.map((c) => <Badge key={c}>{c}</Badge>)}
                {r.work_modes.map((m) => <Badge key={m}>{cap(m)}</Badge>)}
                {r.min_salary ? <Badge>{r.min_salary}+ LPA</Badge> : null}
                {!r.keywords.length && !r.locations.length && !r.companies.length && <span className="text-slate-500">Matches every new job</span>}
              </div>
              <div className="flex gap-2 pt-1"><button onClick={() => setEditing(r)} className={btnSecondary}>Edit</button><button onClick={() => remove(r)} disabled={busyId === r.id} className={btnSecondary}>Delete</button></div>
            </Card>
          ))}
        </div>
      )}
      {editing && (
        <RuleForm
          key={editing === "new" ? "new" : editing.id}
          id={editing === "new" ? undefined : editing.id}
          initial={editing === "new" ? blank : { ...blank, ...editing }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
