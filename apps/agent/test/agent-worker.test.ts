import assert from "node:assert/strict";
import test from "node:test";

import { AgentWorker } from "../src/runtime/jobs/agent-worker";
import { InMemoryJobQueue } from "../src/runtime/jobs/in-memory-job-queue";
import type { JobEnvelope, JobStatus } from "../src/runtime/jobs/job-contracts";

async function waitForStatus(
  queue: InMemoryJobQueue,
  jobId: string,
  status: JobStatus,
) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const job = await queue.get(jobId);
    if (job?.status === status) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Job ${jobId} did not reach ${status}`);
}

test("processes multiple jobs without restarting", async () => {
  const queue = new InMemoryJobQueue();
  const processed: string[] = [];
  const worker = new AgentWorker({
    queue,
    process: async (job) => {
      processed.push(job.id);
      return { status: "ready", chain: "Stellar", llmInvoked: false };
    },
  });

  worker.start();
  const first = await queue.enqueue({
    name: "onchain-sync",
    payload: { chain: "Stellar" },
  });
  const second = await queue.enqueue({
    name: "onchain-sync",
    payload: { chain: "Stellar" },
  });

  await waitForStatus(queue, first.id, "completed");
  await waitForStatus(queue, second.id, "completed");
  await worker.close();

  assert.deepEqual(processed, [first.id, second.id]);
});

test("marks failures and continues processing", async () => {
  const queue = new InMemoryJobQueue();
  let calls = 0;
  const worker = new AgentWorker({
    queue,
    process: async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("provider unavailable");
      }
      return { status: "ready", chain: "Stellar", llmInvoked: false };
    },
  });

  worker.start();
  const failed = await queue.enqueue({
    name: "onchain-sync",
    payload: { chain: "Stellar" },
  });
  const completed = await queue.enqueue({
    name: "onchain-sync",
    payload: { chain: "Stellar" },
  });

  const failedResult: JobEnvelope = await waitForStatus(
    queue,
    failed.id,
    "failed",
  );
  await waitForStatus(queue, completed.id, "completed");
  await worker.close();

  assert.equal(failedResult.error?.code, "WORKER_EXECUTION_FAILED");
  assert.equal(calls, 2);
});
