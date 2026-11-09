import AlertsManager from "@/components/AlertsManager";
import { query } from "@/lib/db";
import type { AlertRule } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Alerts · JobAlert" };

export default async function AlertsPage() {
  const rules = await query<AlertRule>("SELECT * FROM alert_rules ORDER BY created_at DESC");
  return <AlertsManager rules={rules} />;
}
