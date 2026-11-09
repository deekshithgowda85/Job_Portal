import Link from "next/link";
import { cn } from "@/lib/utils";

export default function Pagination({ page, total, pageSize, basePath, params }: { page: number; total: number; pageSize: number; basePath: string; params: URLSearchParams }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const n = new URLSearchParams(params);
    n.set("page", String(p));
    return `${basePath}?${n.toString()}`;
  };
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  const item = "rounded-lg border px-3 py-1.5 text-sm";
  return (
    <nav className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
      {page > 1 ? <Link href={href(page - 1)} className={cn(item, "border-slate-200 text-slate-700 hover:bg-slate-50")}>Previous</Link> : <span className={cn(item, "border-slate-100 text-slate-300")}>Previous</span>}
      {nums.map((n) => (
        <Link key={n} href={href(n)} className={cn(item, n === page ? "border-blue-600 bg-blue-50 text-blue-600" : "border-slate-200 text-slate-700 hover:bg-slate-50")}>{n}</Link>
      ))}
      {page < pages ? <Link href={href(page + 1)} className={cn(item, "border-slate-200 text-slate-700 hover:bg-slate-50")}>Next</Link> : <span className={cn(item, "border-slate-100 text-slate-300")}>Next</span>}
    </nav>
  );
}
