import assert from "node:assert/strict";
import test from "node:test";

import { createBullMqJobRuntime } from "../src/runtime/jobs/bullmq-job-queue";

test(
  "retries a transient failure through external Redis",
  { skip: !process.env.REDIS_URL, timeout: 20_000 },
  async () => {
    let calls = 0;
    const runtime = createBullMqJobRuntime({
      redisUrl: process.env.REDIS_URL!,
      queueName: `shire-agent-live-test-${crypto.randomUUID()}`,
      attempts: 3,
      backoffMs: 50,
      process: async () => {
        calls += 1;
        if (calls === 1) {
          throw Object.assign(new Error("temporary outage"), {
            statusCode: 503,
          });
        }
        return { status: "ready", chain: "Stellar", llmInvoked: false };
      },
    });

    await runtime.start();
    try {
      const accepted = await runtime.enqueue({
        name: "onchain-sync",
        payload: { chain: "Stellar" },
      });
      let job = await runtime.get(accepted.id);
      for (let index = 0; index < 200 && job?.status !== "completed"; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        job = await runtime.get(accepted.id);
      }

      assert.equal(job?.status, "completed");
      assert.equal(job?.attempts, 2);
      assert.equal(calls, 2);
    } finally {
      await runtime.close();
    }
  },
);
