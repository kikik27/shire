import assert from "node:assert/strict";
import test from "node:test";

import { resolveChatContext } from "../src/runtime/chat/context";

test("candidate chat context keeps only safe owned resources", () => {
  const context = resolveChatContext({
    viewerId: "candidate-001",
    role: "candidate",
    resourceType: "job",
    resourceId: "job-001",
  });

  assert.deepEqual(context.policy, {
    allowed: true,
    scope: "owned",
    reason: "Candidate candidate-001 may access viewed job job-001.",
  });
  assert.deepEqual(context.viewer, {
    viewerId: "candidate-001",
    role: "candidate",
  });
  assert.deepEqual(context.resource, {
    resourceType: "job",
    resourceId: "job-001",
  });
  assert.equal(context.resources.viewerProfile?.id, "candidate-001");
  assert.deepEqual(
    context.resources.viewerApplications?.map((application) => application.id),
    ["application-001"],
  );
  assert.equal(context.resources.viewedJob?.id, "job-001");
  assert.equal(context.resources.viewedCompany, undefined);
  assert.equal(context.resources.tiedCandidates, undefined);
});

test("recruiter chat context includes tied candidates but omits unrelated resources", () => {
  const context = resolveChatContext({
    viewerId: "recruiter-002",
    role: "recruiter",
    resourceType: "candidate",
    resourceId: "candidate-002",
  });

  assert.deepEqual(context.policy, {
    allowed: true,
    scope: "related",
    reason:
      "Recruiter recruiter-002 may access candidate candidate-002 tied to job job-002.",
  });
  assert.deepEqual(context.resources.ownedCompanies?.map((company) => company.id), [
    "company-002",
  ]);
  assert.deepEqual(context.resources.ownedJobs?.map((job) => job.id), ["job-002"]);
  assert.deepEqual(context.resources.viewedCandidate?.id, "candidate-002");
  assert.deepEqual(
    context.resources.tiedCandidates?.map((candidate) => candidate.id),
    ["candidate-002"],
  );
  assert.equal(context.resources.viewerProfile, undefined);
  assert.equal(context.resources.viewedCompany, undefined);
});

test("forbidden resources are omitted from resolved context", () => {
  const context = resolveChatContext({
    viewerId: "candidate-001",
    role: "candidate",
    resourceType: "company",
    resourceId: "company-001",
  });

  assert.equal(context.policy.allowed, false);
  assert.equal(context.resource, undefined);
  assert.equal(context.resources.viewedCompany, undefined);
  assert.equal(context.resources.viewedCandidate, undefined);
  assert.equal(context.resources.tiedCandidates, undefined);
  assert.equal(context.resources.ownedCompanies, undefined);
});
