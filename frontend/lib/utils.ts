import clsx, { type ClassValue } from "clsx";

export const cn = (...v: ClassValue[]) => clsx(v);

export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const s = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export const cap = (s: string | null | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

export function formatSalary(job: { salary_min: number | null; salary_max: number | null; salary_range: string | null }) {
  if (job.salary_range) return job.salary_range;
  const lpa = (n: number) => `${+(n / 100000).toFixed(1)} LPA`;
  if (job.salary_min && job.salary_max) return `${lpa(job.salary_min)} - ${lpa(job.salary_max)}`;
  if (job.salary_max) return `Up to ${lpa(job.salary_max)}`;
  if (job.salary_min) return `From ${lpa(job.salary_min)}`;
  return null;
}

export function greeting(): { text: string; date: string } {
  const tz = "Asia/Kolkata";
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: tz }).format(new Date())) % 24;
  const text = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const date = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tz }).format(new Date());
  return { text, date };
}
