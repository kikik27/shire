import assert from "node:assert/strict";
import test from "node:test";

import {
  MATCHING_EVALUATION_STATUSES,
  MATCHING_SCORING_VERSION,
} from "@shire/shared";

import { parseJobRequest } from "../src/runtime/jobs/job-contracts";

test("matching evaluation statuses and scoring version are stable", () => {
  assert.deepEqual(MATCHING_EVALUATION_STATUSES, [
    "PENDING",
    "RUNNING",
    "COMPLETED",
    "FAILED",
  ]);
  assert.equal(MATCHING_SCORING_VERSION, "matching-v1");
});

test("parses a valid cv parse payload", () => {
  assert.deepEqual(
    parseJobRequest({
      name: "cv-parse",
      payload: {
        candidateId: "candidate-001",
        rawCv: "Senior TypeScript engineer",
      },
    }),
    {
      name: "cv-parse",
      payload: {
        candidateId: "candidate-001",
        rawCv: "Senior TypeScript engineer",
      },
    },
  );
});

test("rejects an empty CV", () => {
  assert.throws(() =>
    parseJobRequest({
      name: "cv-parse",
      payload: { candidateId: "candidate-001", rawCv: "" },
    }),
  );
});

test("rejects unknown jobs", () => {
  assert.throws(() => parseJobRequest({ name: "unknown", payload: {} }));
});

test("parses a strict matching-pair request with a semantic deduplication key", () => {
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

  assert.deepEqual(parseJobRequest(request), request);
  assert.throws(() =>
    parseJobRequest({
      ...request,
      unexpected: true,
    }),
  );
  assert.throws(() =>
    parseJobRequest({
      ...request,
      payload: { ...request.payload, unexpected: true },
    }),
  );
});

test("rejects an unbounded deduplication key", () => {
  assert.throws(() =>
    parseJobRequest({
      name: "matching-pair",
      payload: {
        candidateId: "candidate-001",
        jobId: "job-001",
        inputHash: "fingerprint-001",
      },
      deduplicationKey: "x".repeat(257),
    }),
  );
});
