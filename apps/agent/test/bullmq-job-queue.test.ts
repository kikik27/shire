import assert from "node:assert/strict";
import test from "node:test";

import {
  createBullDeduplicationJobId,
  createBullJobOptions,
  mapBullJobEnvelope,
} from "../src/runtime/jobs/bullmq-job-queue";

test("uses three attempts with exponential delayed retry", () => {
  assert.deepEqual(createBullJobOptions({ attempts: 3, backoffMs: 5_000 }), {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: false,
    removeOnFail: false,
  });
});

test("uses a deterministic Bull-safe custom id for semantic deduplication keys", () => {
  const semanticKey =
    "matching-pair:candidate-001:job-001:fingerprint-001";
  const jobId = createBullDeduplicationJobId(semanticKey);

  assert.equal(
    jobId,
    "dedup-c252d88c76d91bb299c64925e39718ca923201c181f45b2f81913ac30b590aa0",
  );
  assert.doesNotMatch(jobId, /:/);
  assert.doesNotMatch(jobId, /^\d+$/);
  assert.deepEqual(
    createBullJobOptions({
      attempts: 3,
      backoffMs: 5_000,
      jobId,
    }),
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: false,
      removeOnFail: false,
      jobId,
    },
  );
});

test("maps delayed BullMQ jobs with ownership and retry metadata", async () => {
  const envelope = await mapBullJobEnvelope(
    {
      id: "job-1",
      name: "cv-parse",
      data: {
        name: "cv-parse",
        payload: { candidateId: "candidate-1", rawCv: "CV" },
      },
      attemptsMade: 1,
      opts: { attempts: 3, delay: 5_000 },
      delay: 5_000,
      timestamp: 1_000,
      processedOn: 2_000,
      returnvalue: null,
      failedReason: undefined,
      getState: async () => "delayed",
    },
    "candidate-1",
  );

  assert.equal(envelope?.status, "delayed");
  assert.equal(envelope?.attempts, 1);
  assert.equal(envelope?.maxAttempts, 3);
  assert.equal(envelope?.nextRetryAt, new Date(7_000).toISOString());
  assert.equal(
    await mapBullJobEnvelope(
      {
        id: "job-1",
        name: "cv-parse",
        data: {
          name: "cv-parse",
          payload: { candidateId: "candidate-1", rawCv: "CV" },
        },
        attemptsMade: 0,
        opts: {},
        timestamp: 1,
        returnvalue: null,
        getState: async () => "waiting",
      },
      "candidate-2",
    ),
    undefined,
  );
});
