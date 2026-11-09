import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { sendDailyAlerts, sendInstantAlerts, sendWeeklyAlerts } from "@/inngest/functions/alerts";

// Inngest verifies its own signature (INNGEST_SIGNING_KEY) on every request here.
export const { GET, POST, PUT } = serve({ client: inngest, functions: [sendDailyAlerts, sendWeeklyAlerts, sendInstantAlerts] });
