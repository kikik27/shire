import assert from "node:assert/strict";
import test from "node:test";

import { AgentWorker } from "../src/runtime/jobs/agent-worker";
import { InMemoryJobQueue } from "../src/runtime/jobs/in-memory-job-queue";
import { createJobProcessors } from "../src/runtime/jobs/job-processors";

const liveEnabled = process.env.SHIRE_LIVE_LLM_TESTS === "true";
const hasKey = Boolean(
  process.env.SHIRE_TEXT_API_KEY ?? process.env.TOKENROUTER_API_KEY,
);

test(
  "processes a CV through the live LLM worker",
  { skip: !liveEnabled || !hasKey },
  async () => {
    const queue = new InMemoryJobQueue();
    const processors = createJobProcessors();
    const worker = new AgentWorker({
      queue,
      process: processors.process,
    });
    worker.start();

    try {
      const accepted = await queue.enqueue({
        name: "cv-parse",
        payload: {
          candidateId: "live-test-candidate",
          rawCv:
            "Maya Okafor. Senior frontend engineer. TypeScript, React, accessibility.",
        },
      });

      let completed = await queue.get(accepted.id);
      for (let attempt = 0; attempt < 600; attempt += 1) {
        completed = await queue.get(accepted.id);
        if (
          completed?.status === "completed" ||
          completed?.status === "failed"
        ) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      assert.equal(
        completed?.status,
        "completed",
        completed?.error?.message,
      );
      assert.equal(completed.result?.llmInvoked, true);
      if (completed.result?.llmInvoked) {
        assert.ok(completed.result.usage.length >= 1);
        assert.ok(completed.result.usage[0]?.provider);
        assert.ok(completed.result.usage[0]?.model);
        assert.ok(completed.result.embeddingDimensions > 0);
      }
    } finally {
      await worker.close();
    }
  },
);
