import { inngest } from "@/lib/inngest";
import { loadRuleIds } from "@/lib/dispatch";
import { enqueueRules } from "@/lib/queue";

function makeAlertFunction(id: string, cron: string, frequency: "daily" | "weekly" | "instant") {
  return inngest.createFunction({ id }, { cron }, async ({ step }) => {
    const ruleIds = await step.run("load-rules", () => loadRuleIds(frequency));
    const enqueued = await step.run("enqueue-alerts", () => enqueueRules(ruleIds));
    return { enqueued };
  });
}

export const sendDailyAlerts = makeAlertFunction("send-daily-alerts", "TZ=Asia/Kolkata 0 7 * * *", "daily");
export const sendWeeklyAlerts = makeAlertFunction("send-weekly-alerts", "TZ=Asia/Kolkata 0 8 * * 1", "weekly");
export const sendInstantAlerts = makeAlertFunction("send-instant-alerts", "*/15 * * * *", "instant");
