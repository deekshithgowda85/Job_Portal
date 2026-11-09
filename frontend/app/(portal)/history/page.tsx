import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "History · JobAlert" };

export default async function HistoryPage() {
  const rows = await query<{ id: string; rule_name: string | null; job_count: number; status: string; error: string | null; sent_at: string }>(
    "SELECT * FROM alert_emails ORDER BY sent_at DESC LIMIT 200",
  );
  return (
    <>
      <PageHeader title="Email history" subtitle="Every alert email sent to you." />
      {rows.length === 0 ? (
        <EmptyState title="No emails sent yet" hint="Alert emails are listed here after the first scheduled run." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">{["Date", "Jobs", "Alert", "Status"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">{new Date(r.sent_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</td>
                  <td className="px-4 py-3">{r.job_count}</td>
                  <td className="px-4 py-3 text-slate-600">{r.rule_name ?? "Deleted alert"}</td>
                  <td className="px-4 py-3"><Badge tone={r.status === "delivered" ? "blue" : "dark"} title={r.error ?? undefined}>{r.status === "delivered" ? "Delivered" : "Failed"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
