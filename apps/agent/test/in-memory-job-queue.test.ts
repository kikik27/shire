import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryJobQueue } from "../src/runtime/jobs/in-memory-job-queue";

test("enqueues and reserves jobs in FIFO order", async () => {
  const queue = new InMemoryJobQueue();
  const first = await queue.enqueue({
    name: "onchain-sync",
    payload: { chain: "Celo" },
  });
  const second = await queue.enqueue({
    name: "cv-parse",
    payload: { candidateId: "candidate-001", rawCv: "CV" },
  });

  assert.equal((await queue.reserve())?.id, first.id);
  assert.equal((await queue.reserve())?.id, second.id);
});

test("tracks completed results", async () => {
  const queue = new InMemoryJobQueue();
  const job = await queue.enqueue({
    name: "onchain-sync",
    payload: { chain: "Celo" },
  });

  await queue.markActive(job.id);
  await queue.markCompleted(job.id, {
    status: "ready",
    chain: "Celo",
    llmInvoked: false,
  });

  const completed = await queue.get(job.id);
  assert.equal(completed?.status, "completed");
  assert.deepEqual(completed?.result, {
    status: "ready",
    chain: "Celo",
    llmInvoked: false,
  });
});

test("deduplicates deterministic jobs without adding a second waiting entry", async () => {
  const queue = new InMemoryJobQueue();
  const request = {
    name: "matching-pair",
    payload: {
      candidateId: "candidate-001",
      jobId: "job-001",
      inputHash: "fingerprint-001",
    },
    deduplicationKey:
      "matching-pair:candidate-001:job-001:fingerprint-001",
  } as const;

  const first = await queue.enqueue(request);
  const duplicate = await queue.enqueue(request);

  assert.equal(duplicate.id, first.id);
  assert.equal(duplicate.deduplicated, true);
  assert.equal((await queue.reserve())?.id, first.id);
  assert.equal(await queue.reserve(), undefined);
});

test("retains completed deterministic jobs for deduplication", async () => {
  const queue = new InMemoryJobQueue();
  const request = {
    name: "matching-pair",
    payload: {
      candidateId: "candidate-001",
      jobId: "job-001",
      inputHash: "fingerprint-001",
    },
    deduplicationKey:
      "matching-pair:candidate-001:job-001:fingerprint-001",
  } as const;
  const first = await queue.enqueue(request);
  assert.equal((await queue.reserve())?.id, first.id);
  await queue.markActive(first.id);
  await queue.markCompleted(first.id, {
    status: "completed",
    claimed: true,
    recommended: true,
    recommendationRowsWritten: 2,
    llmInvoked: false,
    durationMs: 5,
  });

  const duplicate = await queue.enqueue(request);

  assert.equal(duplicate.id, first.id);
  assert.equal(duplicate.status, "completed");
  assert.equal(duplicate.deduplicated, true);
  assert.equal(await queue.reserve(), undefined);
});

test("retains failed deterministic jobs for deduplication", async () => {
  const queue = new InMemoryJobQueue();
  const request = {
    name: "matching-pair",
    payload: {
      candidateId: "candidate-001",
      jobId: "job-001",
      inputHash: "fingerprint-failed",
    },
    deduplicationKey:
      "matching-pair:candidate-001:job-001:fingerprint-failed",
  } as const;
  const first = await queue.enqueue(request);
  assert.equal((await queue.reserve())?.id, first.id);
  await queue.markActive(first.id);
  await queue.markFailed(first.id, {
    code: "MATCHING_FAILED",
    message: "temporary failure",
  });

  const duplicate = await queue.enqueue(request);

  assert.equal(duplicate.id, first.id);
  assert.equal(duplicate.status, "failed");
  assert.equal(duplicate.deduplicated, true);
  assert.equal((await queue.get(first.id))?.status, "failed");
  assert.equal(await queue.reserve(), undefined);
});

test("rejects reuse of a deduplication key for different request content", async () => {
  const queue = new InMemoryJobQueue();
  const deduplicationKey = "matching-pair:stable";
  await queue.enqueue({
    name: "matching-pair",
    payload: {
      candidateId: "candidate-001",
      jobId: "job-001",
      inputHash: "fingerprint-001",
    },
    deduplicationKey,
  });

  await assert.rejects(
    queue.enqueue({
      name: "matching-pair",
      payload: {
        candidateId: "candidate-001",
        jobId: "job-002",
        inputHash: "fingerprint-002",
      },
      deduplicationKey,
    }),
    /Deduplication key conflict: matching-pair:stable/,
  );
});
