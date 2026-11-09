import { Queue, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";

export const ALERT_QUEUE = "job-alerts";

export function createRedisConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set (use the rediss:// TCP URL from Upstash)");
  return new IORedis(url, { maxRetriesPerRequest: null }) as unknown as ConnectionOptions;
}

let queue: Queue | null = null;

export function getAlertQueue(): Queue {
  if (!queue) queue = new Queue(ALERT_QUEUE, { connection: createRedisConnection() });
  return queue;
}

export async function enqueueRules(ruleIds: string[]): Promise<number> {
  const q = getAlertQueue();
  for (const ruleId of ruleIds) {
    await q.add("send-alert", { ruleId }, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }
  return ruleIds.length;
}
