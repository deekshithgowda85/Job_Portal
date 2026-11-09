import { Worker } from "bullmq";
import { processRule } from "../lib/dispatch";
import { ALERT_QUEUE, createRedisConnection } from "../lib/queue";

const worker = new Worker(
  ALERT_QUEUE,
  async (job) => {
    const result = await processRule(job.data.ruleId as string);
    console.log(`[worker] rule ${job.data.ruleId}: sent ${result.sent} jobs`);
    return result;
  },
  { connection: createRedisConnection(), concurrency: 2 },
);

worker.on("failed", (job, err) => console.error(`[worker] job ${job?.id} failed:`, err.message));
worker.on("ready", () => console.log("[worker] ready and waiting for alert jobs"));

process.on("SIGINT", async () => {
  await worker.close();
  process.exit(0);
});
