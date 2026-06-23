import assert from "node:assert/strict";
import test from "node:test";

import { evaluateChatPolicy } from "../src/runtime/chat/policy";

test("candidates can access their own profile, applications, and viewed jobs", () => {
  assert.deepEqual(
    evaluateChatPolicy({
      viewerId: "candidate-001",
      role: "candidate",
      resourceType: "job",
      resourceId: "job-001",
    }),
    {
      allowed: true,
      scope: "owned",
      reason: "Candidate candidate-001 may access viewed job job-001.",
    },
  );
});

test("recruiters can access company jobs and candidates tied to their jobs", () => {
  assert.deepEqual(
    evaluateChatPolicy({
      viewerId: "recruiter-002",
      role: "recruiter",
      resourceType: "candidate",
      resourceId: "candidate-002",
    }),
    {
      allowed: true,
      scope: "related",
      reason:
        "Recruiter recruiter-002 may access candidate candidate-002 tied to job job-002.",
    },
  );
});

test("unrelated resources are forbidden", () => {
  const result = evaluateChatPolicy({
    viewerId: "candidate-001",
    role: "candidate",
    resourceType: "company",
    resourceId: "company-001",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.scope, "forbidden");
  assert.match(result.reason, /candidate.*company/i);
});
