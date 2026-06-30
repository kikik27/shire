import assert from "node:assert/strict";
import test from "node:test";

import { createJobProcessors } from "../src/runtime/jobs/job-processors";

test("dispatches deterministic onchain jobs without an LLM", async () => {
  let llmCalls = 0;
  const processors = createJobProcessors({
    processCvParse: async () => {
      llmCalls += 1;
      throw new Error("not expected");
    },
  });

  const result = await processors.process(
    {
      id: "job-1",
      name: "onchain-sync",
      payload: { chain: "Celo" },
    },
    { attempt: 1, signal: new AbortController().signal },
  );

  assert.deepEqual(result, {
    status: "ready",
    chain: "Celo",
    llmInvoked: false,
  });
  assert.equal(llmCalls, 0);
});

test("dispatches one canonical matching pair job", async () => {
  const seen: unknown[] = [];
  const processors = createJobProcessors({
    processMatchingPair: async (payload, context) => {
      seen.push({ payload, context });
      return {
        status: "unchanged",
        claimed: false,
        recommended: true,
        recommendationRowsWritten: 0,
        llmInvoked: false,
        durationMs: 3,
      };
    },
  });
  const signal = new AbortController().signal;

  const result = await processors.process(
    {
      id: "job-1",
      name: "matching-pair",
      payload: {
        candidateId: "candidate-001",
        jobId: "job-001",
        inputHash: "payload-hash-is-observability-only",
      },
    },
    { attempt: 1, signal },
  );

  assert.deepEqual(result, {
    status: "unchanged",
    claimed: false,
    recommended: true,
    recommendationRowsWritten: 0,
    llmInvoked: false,
    durationMs: 3,
  });
  assert.deepEqual(seen, [
    {
      payload: {
        candidateId: "candidate-001",
        jobId: "job-001",
        inputHash: "payload-hash-is-observability-only",
      },
      context: { jobId: "job-1", attempt: 1, signal },
    },
  ]);
});
