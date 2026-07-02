import assert from "node:assert/strict";
import test from "node:test";

import {
  bullJobExecutionContext,
  bullRetryCooldownMs,
  createBullDeduplicationJobId,
  createBullJobOptions,
  enqueueBullJob,
  mapBullJobEnvelope,
  shouldRetryBullJobError,
} from "../src/runtime/jobs/bullmq-job-queue";
import type { JobRequest } from "../src/runtime/jobs/job-contracts";

function matchingRequest(inputHash = "fingerprint-001"): JobRequest {
  return {
    name: "matching-pair",
    payload: {
      candidateId: "candidate-001",
      jobId: "job-001",
      inputHash,
    },
    deduplicationKey: "matching-pair:candidate-001:job-001:generation-1",
  };
}

function bullJob(data: JobRequest) {
  return {
    id: createBullDeduplicationJobId(data.deduplicationKey!),
    name: data.name,
    data,
    attemptsMade: 1,
    delay: 5_000,
    opts: { attempts: 3, delay: 5_000 },
    timestamp: 1_000,
    processedOn: 2_000,
    returnvalue: null,
    getState: async () => "delayed",
  };
}

test("derives reconciliation cooldown from the largest configured Bull retry delay", () => {
  assert.equal(bullRetryCooldownMs({ attempts: 1, backoffMs: 7_000 }), 0);
  assert.equal(bullRetryCooldownMs({ attempts: 4, backoffMs: 7_000 }), 28_000);
});

test("uses each persisted Bull job's attempts for processor finality", () => {
  const signal = new AbortController().signal;

  assert.deepEqual(
    bullJobExecutionContext(
      {
        attemptsMade: 1,
        opts: { attempts: 5 },
        data: matchingRequest(),
      },
      signal,
    ),
    {
      attempt: 2,
      maxAttempts: 3,
      signal,
    },
  );
});

test("legacy matching jobs stop retrying at the canonical evaluation budget", () => {
  assert.equal(
    shouldRetryBullJobError(
      new Error("provider temporarily unavailable"),
      { attempt: 3, maxAttempts: 3 },
    ),
    false,
  );
});

test("durable matching jobs clamp configured attempts to the evaluation budget", async () => {
  const request = matchingRequest();
  let addedAttempts: number | undefined;

  await enqueueBullJob(
    {
      getJob: async () => undefined,
      add: async (_name, data, options) => {
        addedAttempts = options.attempts;
        return {
          ...bullJob(data),
          attemptsMade: 0,
          opts: { attempts: options.attempts as number },
          timestamp: options.timestamp as number,
          getState: async () => "waiting",
        };
      },
    },
    request,
    { attempts: 5, backoffMs: 5_000, now: () => 2_000 },
  );

  assert.equal(addedAttempts, 3);
});

test("retains terminal jobs until reconciliation needs to reuse their id", () => {
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

test("durable matching ids include the effective retry policy version", () => {
  const key = "matching-pair:candidate-001:job-001:fingerprint-001:1";

  assert.notEqual(
    createBullDeduplicationJobId(key, {
      attempts: 3,
      backoffMs: 5_000,
    }),
    createBullDeduplicationJobId(key, {
      attempts: 3,
      backoffMs: 10_000,
    }),
  );
});

test("durable enqueue returns the persisted envelope for identical retained ids", async () => {
  const request = matchingRequest();
  const existing = bullJob(request);
  let addCalls = 0;

  const envelope = await enqueueBullJob(
    {
      getJob: async () => existing,
      add: async () => {
        addCalls += 1;
        return existing;
      },
    },
    request,
    { attempts: 3, backoffMs: 5_000 },
  );

  assert.equal(addCalls, 0);
  assert.equal(envelope.id, existing.id);
  assert.equal(envelope.status, "delayed");
  assert.deepEqual(envelope.payload, request.payload);
  assert.equal(envelope.deduplicated, true);
});

test("durable enqueue rejects retained ids whose persisted request conflicts", async () => {
  const request = matchingRequest();
  const existing = bullJob(matchingRequest("different-fingerprint"));
  let addCalls = 0;

  await assert.rejects(
    enqueueBullJob(
      {
        getJob: async () => existing,
        add: async () => {
          addCalls += 1;
          return existing;
        },
      },
      request,
      { attempts: 3, backoffMs: 5_000 },
    ),
    /Deduplication key conflict/,
  );
  assert.equal(addCalls, 0);
});

test("durable enqueue atomically retries an identical terminal matching job when work is stale again", async () => {
  const request = matchingRequest();
  const retried: unknown[] = [];
  let state = "completed";
  const existing = {
    ...bullJob(request),
    getState: async () => state,
    retry: async (...args: unknown[]) => {
      retried.push(args);
      state = "waiting";
    },
  };
  let addCalls = 0;

  const envelope = await enqueueBullJob(
    {
      getJob: async () => existing,
      add: async () => {
        addCalls += 1;
        return existing;
      },
    },
    request,
    { attempts: 3, backoffMs: 5_000, now: () => 3_000 },
  );

  assert.deepEqual(retried, [
    [
      "completed",
      { resetAttemptsMade: true, resetAttemptsStarted: true },
    ],
  ]);
  assert.equal(addCalls, 0);
  assert.equal(envelope.status, "queued");
  assert.equal(envelope.deduplicated, undefined);
});

test("durable terminal retry race returns the producer winner as deduplicated", async () => {
  const request = matchingRequest();
  const existing = {
    ...bullJob(request),
    getState: async () => "completed",
    retry: async () => {
      throw Object.assign(
        new Error("Job is not in the completed state"),
        { code: -3 },
      );
    },
  };
  const winner = {
    ...bullJob(request),
    getState: async () => "completed",
  };
  let getCalls = 0;

  const envelope = await enqueueBullJob(
    {
      getJob: async () => {
        getCalls += 1;
        return getCalls === 1 ? existing : winner;
      },
      add: async () => {
        throw new Error("add must not be called");
      },
    },
    request,
    { attempts: 3, backoffMs: 5_000 },
  );

  assert.equal(envelope.status, "completed");
  assert.equal(envelope.deduplicated, true);
});

test("durable terminal retry propagates Redis failures instead of claiming deduplication", async () => {
  const request = matchingRequest();
  const redisError = Object.assign(new Error("socket reset"), {
    code: "ECONNRESET",
  });
  const existing = {
    ...bullJob(request),
    getState: async () => "completed",
    retry: async () => {
      throw redisError;
    },
  };

  await assert.rejects(
    enqueueBullJob(
      {
        getJob: async () => existing,
        add: async () => {
          throw new Error("add must not be called");
        },
      },
      request,
      { attempts: 3, backoffMs: 5_000 },
    ),
    (error) => error === redisError,
  );
});

test("durable enqueue detects an identical job won by a concurrent producer", async () => {
  const request = matchingRequest();
  const persisted = bullJob({
    ...request,
    __shireEnqueueToken: "winner-token",
  } as JobRequest);
  let getCalls = 0;
  let addedData: unknown;

  const envelope = await enqueueBullJob(
    {
      getJob: async () => {
        getCalls += 1;
        return getCalls === 1 ? undefined : persisted;
      },
      add: async (_name, data) => {
        addedData = data;
        return {
          ...bullJob(data),
          timestamp: 2_000,
        };
      },
    },
    request,
    {
      attempts: 3,
      backoffMs: 5_000,
      createEnqueueToken: () => "loser-token",
    },
  );

  assert.equal(
    (addedData as { __shireEnqueueToken?: string }).__shireEnqueueToken,
    "loser-token",
  );
  assert.equal(envelope.createdAt, new Date(1_000).toISOString());
  assert.equal(envelope.deduplicated, true);
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
