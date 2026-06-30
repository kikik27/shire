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
