import { cn } from "@/lib/utils";

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)} {...p} />
);

export const Badge = ({ className, tone = "gray", ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "gray" | "blue" | "dark" }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-3 py-1 text-xs",
      tone === "gray" && "bg-slate-100 text-slate-700",
      tone === "blue" && "bg-blue-50 text-blue-700",
      tone === "dark" && "bg-slate-200 font-medium text-slate-900",
      className,
    )}
    {...p}
  />
);

export const Skeleton = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded-lg bg-slate-100", className)} />;

export function EmptyState({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <Card className="px-6 py-14 text-center">
      <p className="text-base font-semibold">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-slate-500">{hint}</p>}
      {children && <div className="mt-5">{children}</div>}
    </Card>
  );
}

export const btnPrimary = "inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";
export const btnSecondary = "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
export const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
