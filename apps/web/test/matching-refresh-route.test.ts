import assert from "node:assert/strict";
import test from "node:test";

import { createCandidateMatchingRefreshHandler } from "../app/api/candidate/recommendations/refresh/route";
import { createRecruiterTalentMatchingRefreshHandler } from "../app/api/recruiter/jobs/[id]/recommendations/refresh/route";
import { createInMemoryProfileRepository } from "../lib/server/profile-repository";
import { createInMemoryJobsRepository } from "../lib/server/jobs-repository";

function mockAuthenticated(privyUserId: string) {
  return async () => ({ mode: "privy", privyUserId }) as const;
}

test("candidate matching refresh enqueues job-matching with the resolved user id", async () => {
  const profiles = createInMemoryProfileRepository();
  const candidate = await profiles.resolveUser("did:privy:candidate");

  let postedUrl = "";
  let postedBody: unknown = null;
  const fetchStub = (async (url: string, init: RequestInit) => {
    postedUrl = String(url);
    postedBody = JSON.parse(String(init.body));
    return {
      status: 202,
      headers: new Map([["content-type", "application/json"]]),
      arrayBuffer: async () =>
        new TextEncoder().encode(JSON.stringify({ jobId: "agent-job-1", status: "queued" })).buffer,
    };
  }) as unknown as typeof fetch;

  const previousUrl = process.env.SHIRE_AGENT_INTERNAL_URL;
  const previousToken = process.env.SHIRE_AGENT_SERVICE_TOKEN;
  process.env.SHIRE_AGENT_INTERNAL_URL = "http://agent.local";
  process.env.SHIRE_AGENT_SERVICE_TOKEN = "secret";
  try {
    const handler = createCandidateMatchingRefreshHandler({
      resolveAuthenticatedUser: mockAuthenticated("did:privy:candidate"),
      repository: profiles,
      fetch: fetchStub,
    });

    const response = await handler(
      new Request("http://localhost/api/candidate/recommendations/refresh", {
        method: "POST",
      }),
    );

    assert.equal(response.status, 202);
    assert.match(postedUrl, /\/jobs$/);
    assert.deepEqual(postedBody, {
      name: "job-matching",
      payload: { candidateId: candidate.id },
    });
  } finally {
    if (previousUrl === undefined) delete process.env.SHIRE_AGENT_INTERNAL_URL;
    else process.env.SHIRE_AGENT_INTERNAL_URL = previousUrl;
    if (previousToken === undefined) delete process.env.SHIRE_AGENT_SERVICE_TOKEN;
    else process.env.SHIRE_AGENT_SERVICE_TOKEN = previousToken;
  }
});

test("candidate matching refresh returns 500 when agent config is missing", async () => {
  const profiles = createInMemoryProfileRepository();
  await profiles.resolveUser("did:privy:candidate");

  // No env set: agentConfig() returns undefined. Override fetch to assert it's
  // never called by checking we never reach the forward stage.
  let fetchCalled = false;
  const handler = createCandidateMatchingRefreshHandler({
    resolveAuthenticatedUser: mockAuthenticated("did:privy:candidate"),
    repository: profiles,
    fetch: (async () => {
      fetchCalled = true;
      return {} as Response;
    }) as unknown as typeof fetch,
  });

  // Force agent config missing by clearing env.
  const previousUrl = process.env.SHIRE_AGENT_INTERNAL_URL;
  const previousToken = process.env.SHIRE_AGENT_SERVICE_TOKEN;
  delete process.env.SHIRE_AGENT_INTERNAL_URL;
  delete process.env.SHIRE_AGENT_SERVICE_TOKEN;
  try {
    const response = await handler(
      new Request("http://localhost/api/candidate/recommendations/refresh", {
        method: "POST",
      }),
    );
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "missing-agent-configuration" });
    assert.equal(fetchCalled, false);
  } finally {
    if (previousUrl !== undefined) process.env.SHIRE_AGENT_INTERNAL_URL = previousUrl;
    if (previousToken !== undefined) process.env.SHIRE_AGENT_SERVICE_TOKEN = previousToken;
  }
});

test("recruiter talent matching refresh returns 404 for a job the recruiter does not own", async () => {
  const profiles = createInMemoryProfileRepository();
  const recruiter = await profiles.resolveUser("did:privy:recruiter");
  const jobs = createInMemoryJobsRepository();

  const handler = createRecruiterTalentMatchingRefreshHandler({
    resolveAuthenticatedUser: mockAuthenticated("did:privy:recruiter"),
    profileRepository: profiles,
    jobsRepository: jobs,
    fetch: (async () => ({} as Response)) as unknown as typeof fetch,
  });

  const response = await handler(
    new Request("http://localhost/api/recruiter/jobs/unknown/recommendations/refresh", {
      method: "POST",
    }),
    { params: Promise.resolve({ id: "unknown" }) },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "job-not-found" });
  void recruiter;
});

test("recruiter talent matching refresh enqueues talent-matching for an owned job", async () => {
  const profiles = createInMemoryProfileRepository();
  const recruiter = await profiles.resolveUser("did:privy:recruiter");
  const jobs = createInMemoryJobsRepository();
  const job = await jobs.createJob(recruiter.id, {
    title: "Senior Engineer",
    description: "Build things.",
    companyName: "Acme",
    location: "Jakarta",
    remote: true,
    salaryRange: "120000-160000",
    jobType: "FULL_TIME",
    experienceLevel: "SENIOR",
    skillsRequired: ["typescript", "react"],
    candidateStakeRequired: false,
  });

  let postedBody: unknown = null;
  const fetchStub = (async (_url: string, init: RequestInit) => {
    postedBody = JSON.parse(String(init.body));
    return {
      status: 202,
      headers: new Map([["content-type", "application/json"]]),
      arrayBuffer: async () =>
        new TextEncoder().encode(JSON.stringify({ jobId: "agent-job-2", status: "queued" })).buffer,
    };
  }) as unknown as typeof fetch;

  // Set agent env so agentConfig() resolves.
  const previousUrl = process.env.SHIRE_AGENT_INTERNAL_URL;
  const previousToken = process.env.SHIRE_AGENT_SERVICE_TOKEN;
  process.env.SHIRE_AGENT_INTERNAL_URL = "http://agent.local";
  process.env.SHIRE_AGENT_SERVICE_TOKEN = "secret";
  try {
    const handler = createRecruiterTalentMatchingRefreshHandler({
      resolveAuthenticatedUser: mockAuthenticated("did:privy:recruiter"),
      profileRepository: profiles,
      jobsRepository: jobs,
      fetch: fetchStub,
    });

    const response = await handler(
      new Request(
        `http://localhost/api/recruiter/jobs/${job.id}/recommendations/refresh`,
        { method: "POST" },
      ),
      { params: Promise.resolve({ id: job.id }) },
    );

    assert.equal(response.status, 202);
    assert.deepEqual(postedBody, {
      name: "talent-matching",
      payload: { jobId: job.id },
    });
  } finally {
    if (previousUrl === undefined) delete process.env.SHIRE_AGENT_INTERNAL_URL;
    else process.env.SHIRE_AGENT_INTERNAL_URL = previousUrl;
    if (previousToken === undefined) delete process.env.SHIRE_AGENT_SERVICE_TOKEN;
    else process.env.SHIRE_AGENT_SERVICE_TOKEN = previousToken;
  }
});
