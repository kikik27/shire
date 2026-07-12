import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryJobsRepository } from "../lib/server/jobs-repository";
import type { CreateJobInput } from "../lib/server/jobs-repository";
import {
  createCandidateJobRouteHandlers,
  createCandidateJobsRouteHandlers,
  createJobsRouteHandlers,
} from "../lib/server/jobs-route";
import { createInMemoryProfileRepository } from "../lib/server/profile-repository";
import { createInMemoryRecommendationsRepository } from "../lib/server/recommendations-repository";

function authenticated(privyUserId = "did:privy:recruiter") {
  return async () => ({ mode: "stellar", privyUserId, walletAddress: "GTESTAUTH" }) as const;
}

function jsonRequest(method: string, body?: unknown) {
  return new Request("http://localhost/api/recruiter/jobs", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const jobPayload = {
  title: "Senior Protocol Engineer",
  description:
    "Build secure protocol infrastructure and partner with product teams on hiring workflows.",
  location: "Jakarta",
  remote: true,
  salaryRange: "$120k-$160k",
  jobType: "FULL_TIME",
  experienceLevel: "SENIOR",
  skillsRequired: ["TypeScript", "Soroban"],
  candidateStakeRequired: false,
} satisfies CreateJobInput;

test("recruiter jobs POST creates a job for the authenticated internal user", async () => {
  const profiles = createInMemoryProfileRepository();
  const jobs = createInMemoryJobsRepository();
  const handlers = createJobsRouteHandlers({
    resolveAuthenticatedUser: authenticated(),
    profileRepository: profiles,
    jobsRepository: jobs,
  });

  const response = await handlers.POST(jsonRequest("POST", jobPayload));

  assert.equal(response.status, 201);
  const body = await response.json();
  const user = await profiles.resolveUser("did:privy:recruiter");
  assert.equal(body.job.recruiterUserId, user.id);
  assert.equal(body.job.title, jobPayload.title);
  assert.deepEqual(
    JSON.parse(JSON.stringify(await jobs.listJobsByRecruiter(user.id))),
    [body.job],
  );
});

test("recruiter jobs GET returns only the authenticated recruiter's jobs", async () => {
  const profiles = createInMemoryProfileRepository();
  const jobs = createInMemoryJobsRepository();
  const user = await profiles.resolveUser("did:privy:recruiter");
  const other = await profiles.resolveUser("did:privy:other");
  const ownJob = await jobs.createJob(user.id, jobPayload);
  await jobs.createJob(other.id, { ...jobPayload, title: "Other Job" });
  const handlers = createJobsRouteHandlers({
    resolveAuthenticatedUser: authenticated(),
    profileRepository: profiles,
    jobsRepository: jobs,
  });

  const response = await handlers.GET(jsonRequest("GET"));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    jobs: JSON.parse(JSON.stringify([ownJob])),
  });
});

test("recruiter jobs POST rejects invalid payloads", async () => {
  const handlers = createJobsRouteHandlers({
    resolveAuthenticatedUser: authenticated(),
    profileRepository: createInMemoryProfileRepository(),
    jobsRepository: createInMemoryJobsRepository(),
  });

  const response = await handlers.POST(jsonRequest("POST", { title: "x" }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid-job" });
});

test("recruiter jobs PATCH updates only the authenticated recruiter's job", async () => {
  const profiles = createInMemoryProfileRepository();
  const jobs = createInMemoryJobsRepository();
  const user = await profiles.resolveUser("did:privy:recruiter");
  const other = await profiles.resolveUser("did:privy:other");
  const ownJob = await jobs.createJob(user.id, jobPayload);
  const otherJob = await jobs.createJob(other.id, jobPayload);
  const handlers = createJobsRouteHandlers({
    resolveAuthenticatedUser: authenticated(),
    profileRepository: profiles,
    jobsRepository: jobs,
  });

  const response = await handlers.PATCH(
    jsonRequest("PATCH", { status: "ACTIVE" }),
    { params: Promise.resolve({ id: ownJob.id }) },
  );
  const forbidden = await handlers.PATCH(
    jsonRequest("PATCH", { status: "ACTIVE" }),
    { params: Promise.resolve({ id: otherJob.id }) },
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).job.status, "ACTIVE");
  assert.equal(forbidden.status, 403);
});

test("candidate jobs GET excludes jobs posted by the same user", async () => {
  const profiles = createInMemoryProfileRepository();
  const jobs = createInMemoryJobsRepository();
  const user = await profiles.resolveUser("did:privy:both");
  const other = await profiles.resolveUser("did:privy:other");
  const ownJob = await jobs.createJob(user.id, { ...jobPayload, title: "Own Job" });
  const otherJob = await jobs.createJob(other.id, { ...jobPayload, title: "Other Job" });
  await jobs.updateJobStatus(ownJob.id, "ACTIVE");
  const activeOtherJob = await jobs.updateJobStatus(otherJob.id, "ACTIVE");
  const handlers = createCandidateJobsRouteHandlers({
    resolveAuthenticatedUser: authenticated("did:privy:both"),
    profileRepository: profiles,
    jobsRepository: jobs,
  });

  const response = await handlers.GET(jsonRequest("GET"));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    jobs: JSON.parse(JSON.stringify([activeOtherJob])),
  });
});

test("candidate job detail includes the authenticated candidate's persisted evaluation", async () => {
  const profiles = createInMemoryProfileRepository();
  const jobs = createInMemoryJobsRepository();
  const recommendations = createInMemoryRecommendationsRepository();
  const candidate = await profiles.resolveUser("did:privy:candidate");
  const recruiter = await profiles.resolveUser("did:privy:recruiter");
  const draft = await jobs.createJob(recruiter.id, jobPayload);
  const job = await jobs.updateJobStatus(draft.id, "ACTIVE");
  recommendations.seed({
    id: "recommendation-1",
    type: "JOB_TO_CANDIDATE",
    candidateUserId: candidate.id,
    recruiterUserId: recruiter.id,
    jobId: job.id,
    matchScore: 83,
    confidence: 0.82,
    reasons: ["Required skills match"],
    missingRequirements: [],
    riskFlags: [],
    recommendedAction: "SUGGEST_APPLY",
    status: "NEW",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const handlers = createCandidateJobRouteHandlers({
    resolveAuthenticatedUser: authenticated("did:privy:candidate"),
    profileRepository: profiles,
    jobsRepository: jobs,
    recommendationsRepository: recommendations,
  });

  const response = await handlers.GET(jsonRequest("GET"), {
    params: Promise.resolve({ id: job.id }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body.match, {
    score: 83,
    confidence: 0.82,
    reasons: ["Required skills match"],
    missingRequirements: [],
    recommendedAction: "SUGGEST_APPLY",
  });
});

test("candidate job detail returns no match when no persisted evaluation exists", async () => {
  const profiles = createInMemoryProfileRepository();
  const jobs = createInMemoryJobsRepository();
  const recruiter = await profiles.resolveUser("did:privy:recruiter");
  const draft = await jobs.createJob(recruiter.id, jobPayload);
  const job = await jobs.updateJobStatus(draft.id, "ACTIVE");
  const handlers = createCandidateJobRouteHandlers({
    resolveAuthenticatedUser: authenticated("did:privy:candidate"),
    profileRepository: profiles,
    jobsRepository: jobs,
    recommendationsRepository: createInMemoryRecommendationsRepository(),
  });

  const response = await handlers.GET(jsonRequest("GET"), {
    params: Promise.resolve({ id: job.id }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    job: JSON.parse(JSON.stringify(job)),
    match: null,
  });
});
