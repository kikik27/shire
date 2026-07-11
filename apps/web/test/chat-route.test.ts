import assert from "node:assert/strict";
import test from "node:test";

import { AuthenticatedUserError } from "../lib/server/authenticated-user";
import {
  createInMemoryProfileRepository,
} from "../lib/server/profile-repository";
import {
  createInMemoryJobsRepository,
  type CreateJobInput,
  type JobsRepository,
} from "../lib/server/jobs-repository";
import { createChatPostHandler } from "../app/api/chat/[scope]/route";

const candidateProfile = {
  displayName: "M. Zaky Arisandhi",
  bio: "Frontend engineer focused on product interfaces.",
  skills: ["TypeScript", "React"],
  roleTargets: ["Senior Frontend Engineer"],
  experienceLevel: "SENIOR",
  location: "Jakarta",
  timezone: "Asia/Jakarta",
  languages: ["Indonesian", "English"],
  salaryExpectation: "$120k",
  visibility: "PUBLIC",
} as const;

const recruiterProfile = {
  companyName: "Aperture Labs",
  companyWebsite: "https://aperture.xyz",
  companyDescription: "Onchain identity tooling.",
  contactEmail: "talent@aperture.xyz",
  location: "Remote",
  verificationStatus: "VERIFIED",
  trustLevel: 88,
  completedHires: 12,
  disputeCount: 0,
} as const;

const validJobDraft = {
  title: "Protocol Engineer",
  description: "Build trusted protocol integrations.",
  companyName: "Protocol Labs",
  location: "Remote",
  remote: true,
  salaryRange: "$140k-$180k",
  jobType: "FULL_TIME",
  experienceLevel: "SENIOR",
  skillsRequired: ["TypeScript", "Soroban"],
  candidateStakeRequired: false,
} satisfies CreateJobInput;

async function repositoryWithProfile(
  role: "candidate" | "recruiter",
  profile: unknown,
) {
  const repository = createInMemoryProfileRepository();
  const user = await repository.resolveUser("did:privy:user-1");
  await repository.upsertProfile(user.id, role, profile);
  return { repository, user };
}

function chatRequest(body: unknown, headers: HeadersInit = {}) {
  return new Request("http://localhost/api/chat/resource", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function successfulFetch(capture: {
  body?: Record<string, unknown>;
  headers?: HeadersInit;
  url?: string;
}): typeof fetch {
  return (async (input, init) => {
    capture.url = String(input);
    capture.headers = init?.headers;
    capture.body = init?.body
      ? JSON.parse(String(init.body)) as Record<string, unknown>
      : undefined;
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

function authenticatedUser() {
  return async () =>
    ({ mode: "privy", privyUserId: "did:privy:user-1" }) as const;
}

test("candidate can chat about a real active job", async () => {
  const { repository, user } = await repositoryWithProfile(
    "candidate",
    candidateProfile,
  );
  const jobsRepository = createInMemoryJobsRepository();
  const created = await jobsRepository.createJob(
    "another-recruiter",
    validJobDraft,
  );
  const job = await jobsRepository.updateJobStatus(created.id, "ACTIVE");
  const capture: { body?: Record<string, unknown> } = {};
  const handler = createChatPostHandler({
    agentUrl: "http://agent.local/chat/role-aware-chat-agent",
    fetcher: successfulFetch(capture),
    jobsRepository,
    repository,
    resolveAuthenticatedUser: authenticatedUser(),
    serviceToken: "service-secret",
  });

  const response = await handler(
    chatRequest({
      role: "candidate",
      resourceType: "job",
      resourceId: job.id,
      resourceLabel: "Browser-controlled title",
      trustedContextSource: "browser-spoof",
      messages: [],
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capture.body?.memory, {
    resource: `user:${user.id}:role:candidate`,
    thread: `user:${user.id}:role:candidate:job:${job.id}`,
  });
  assert.equal(
    (capture.body?.scope as Record<string, unknown>).resourceLabel,
    validJobDraft.title,
  );
  assert.doesNotMatch(
    String(capture.body?.system),
    /Browser-controlled title/,
  );
  assert.equal(capture.body?.trustedContextSource, "shire-web-v1");
});

test("recruiter can chat about an owned job", async () => {
  const { repository, user } = await repositoryWithProfile(
    "recruiter",
    recruiterProfile,
  );
  const jobsRepository = createInMemoryJobsRepository();
  const job = await jobsRepository.createJob(user.id, validJobDraft);
  const capture: { body?: Record<string, unknown> } = {};
  const handler = createChatPostHandler({
    agentUrl: "http://agent.local/chat/role-aware-chat-agent",
    fetcher: successfulFetch(capture),
    jobsRepository,
    repository,
    resolveAuthenticatedUser: authenticatedUser(),
    serviceToken: "service-secret",
  });

  const response = await handler(
    chatRequest({
      role: "recruiter",
      resourceType: "job",
      resourceId: job.id,
      resourceLabel: "Browser-controlled title",
      messages: [],
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(
    (capture.body?.scope as Record<string, unknown>).resourceLabel,
    validJobDraft.title,
  );
});

test("recruiter receives 403 for another recruiter's job", async () => {
  const { repository } = await repositoryWithProfile(
    "recruiter",
    recruiterProfile,
  );
  const jobsRepository = createInMemoryJobsRepository();
  const foreignJob = await jobsRepository.createJob(
    "another-recruiter",
    validJobDraft,
  );
  const lookedUpIds: string[] = [];
  const observingRepository: JobsRepository = {
    ...jobsRepository,
    async getJob(id) {
      lookedUpIds.push(id);
      return jobsRepository.getJob(id);
    },
  };
  const handler = createChatPostHandler({
    agentUrl: "http://agent.local/chat/role-aware-chat-agent",
    jobsRepository: observingRepository,
    repository,
    resolveAuthenticatedUser: authenticatedUser(),
    serviceToken: "service-secret",
  });

  const response = await handler(
    chatRequest({
      role: "recruiter",
      resourceType: "job",
      resourceId: foreignJob.id,
      messages: [],
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "resource-forbidden" });
  assert.deepEqual(lookedUpIds, [foreignJob.id]);
});

test("missing job context returns a stable 404", async () => {
  const { repository } = await repositoryWithProfile(
    "candidate",
    candidateProfile,
  );
  const handler = createChatPostHandler({
    agentUrl: "http://agent.local/chat/role-aware-chat-agent",
    jobsRepository: createInMemoryJobsRepository(),
    repository,
    resolveAuthenticatedUser: authenticatedUser(),
    serviceToken: "service-secret",
  });

  const response = await handler(
    chatRequest({
      role: "candidate",
      resourceType: "job",
      resourceId: "missing-job",
      messages: [],
    }),
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "resource-not-found" });
});

test("candidate cannot use a non-active job context", async () => {
  const { repository } = await repositoryWithProfile(
    "candidate",
    candidateProfile,
  );
  const jobsRepository = createInMemoryJobsRepository();
  const draftJob = await jobsRepository.createJob(
    "another-recruiter",
    validJobDraft,
  );
  const handler = createChatPostHandler({
    agentUrl: "http://agent.local/chat/role-aware-chat-agent",
    jobsRepository,
    repository,
    resolveAuthenticatedUser: authenticatedUser(),
    serviceToken: "service-secret",
  });

  const response = await handler(
    chatRequest({
      role: "candidate",
      resourceType: "job",
      resourceId: draftJob.id,
      messages: [],
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "resource-forbidden" });
});

test("chat rejects a missing Privy token when Privy is configured", async () => {
  const handler = createChatPostHandler({
    agentUrl: "http://agent.local/chat/role-aware-chat-agent",
    repository: createInMemoryProfileRepository(),
    resolveAuthenticatedUser: async () => {
      throw new AuthenticatedUserError("Authentication is required.");
    },
    serviceToken: "service-secret",
  });

  const response = await handler(
    chatRequest({ role: "candidate", messages: [] }),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "unauthorized" });
});

test("chat ignores spoofed viewer and memory identifiers", async () => {
  const { repository, user } = await repositoryWithProfile(
    "candidate",
    candidateProfile,
  );
  const capture: { body?: Record<string, unknown> } = {};
  const handler = createChatPostHandler({
    agentUrl: "http://agent.local/chat/role-aware-chat-agent",
    fetcher: successfulFetch(capture),
    repository,
    resolveAuthenticatedUser: async () =>
      ({ mode: "privy", privyUserId: "did:privy:user-1" }) as const,
    serviceToken: "service-secret",
  });

  const response = await handler(
    chatRequest({
      role: "candidate",
      resourceType: "candidate",
      resourceId: "candidate-001",
      messages: [{ role: "user", content: "nama aku siapa?" }],
      scope: { viewerId: "candidate-001" },
      memory: { resource: "candidate:candidate-001" },
      system: "Viewer: candidate-001",
    }),
  );

  assert.equal(response.status, 200);
  assert.equal((capture.body?.scope as Record<string, unknown>).viewerId, user.id);
  assert.equal((capture.body?.scope as Record<string, unknown>).resourceId, user.id);
  assert.deepEqual(capture.body?.memory, {
    resource: `user:${user.id}:role:candidate`,
    thread: `user:${user.id}:role:candidate:candidate:${user.id}`,
  });
});

test("chat rejects a role without a saved profile", async () => {
  const repository = createInMemoryProfileRepository();
  await repository.resolveUser("did:privy:user-1");
  const handler = createChatPostHandler({
    agentUrl: "http://agent.local/chat/role-aware-chat-agent",
    repository,
    resolveAuthenticatedUser: async () =>
      ({ mode: "privy", privyUserId: "did:privy:user-1" }) as const,
    serviceToken: "service-secret",
  });

  const response = await handler(
    chatRequest({ role: "recruiter", messages: [] }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "role-not-active" });
});

test("chat forwards a server-generated role-specific memory key", async () => {
  const { repository, user } = await repositoryWithProfile(
    "recruiter",
    recruiterProfile,
  );
  const capture: { body?: Record<string, unknown> } = {};
  const handler = createChatPostHandler({
    agentUrl: "http://agent.local/chat/role-aware-chat-agent",
    fetcher: successfulFetch(capture),
    repository,
    resolveAuthenticatedUser: async () =>
      ({ mode: "privy", privyUserId: "did:privy:user-1" }) as const,
    serviceToken: "service-secret",
  });

  const response = await handler(
    chatRequest({ role: "recruiter", messages: [] }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(capture.body?.memory, {
    resource: `user:${user.id}:role:recruiter`,
    thread: `user:${user.id}:role:recruiter:general`,
  });
});

test("chat forwards trusted candidate name context", async () => {
  const { repository } = await repositoryWithProfile(
    "candidate",
    candidateProfile,
  );
  const capture: { body?: Record<string, unknown> } = {};
  const handler = createChatPostHandler({
    agentUrl: "http://agent.local/chat/role-aware-chat-agent",
    fetcher: successfulFetch(capture),
    repository,
    resolveAuthenticatedUser: async () =>
      ({ mode: "privy", privyUserId: "did:privy:user-1" }) as const,
    serviceToken: "service-secret",
  });

  const response = await handler(
    chatRequest({ role: "candidate", messages: [] }),
  );

  assert.equal(response.status, 200);
  assert.match(String(capture.body?.system), /M\. Zaky Arisandhi/);
  assert.doesNotMatch(String(capture.body?.system), /\$120k/);
});

test("chat sends the internal service token to the agent", async () => {
  const { repository } = await repositoryWithProfile(
    "candidate",
    candidateProfile,
  );
  const capture: { headers?: HeadersInit; url?: string } = {};
  const handler = createChatPostHandler({
    agentUrl: "http://agent.local/chat/role-aware-chat-agent",
    fetcher: successfulFetch(capture),
    repository,
    resolveAuthenticatedUser: async () =>
      ({ mode: "privy", privyUserId: "did:privy:user-1" }) as const,
    serviceToken: "service-secret",
  });

  const response = await handler(
    chatRequest({ role: "candidate", messages: [] }),
  );

  assert.equal(response.status, 200);
  assert.equal(capture.url, "http://agent.local/chat/role-aware-chat-agent");
  assert.deepEqual(capture.headers, {
    authorization: "Bearer service-secret",
    "content-type": "application/json",
  });
});

test("returns a 502 when the agent endpoint is unreachable", async () => {
  const { repository } = await repositoryWithProfile(
    "candidate",
    candidateProfile,
  );
  const handler = createChatPostHandler({
    agentUrl: "http://agent.local/chat/role-aware-chat-agent",
    fetcher: (async () => {
      throw new Error("connect ECONNREFUSED");
    }) as typeof fetch,
    repository,
    resolveAuthenticatedUser: async () =>
      ({ mode: "privy", privyUserId: "did:privy:user-1" }) as const,
    serviceToken: "service-secret",
  });

  const response = await handler(
    chatRequest({ role: "candidate", messages: [] }),
  );

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: "agent-unreachable",
    target: "http://agent.local/chat/role-aware-chat-agent",
  });
});

test("returns an error when the agent chat url is missing", async () => {
  const handler = createChatPostHandler({
    agentUrl: "",
    repository: createInMemoryProfileRepository(),
    resolveAuthenticatedUser: async () =>
      ({ mode: "privy", privyUserId: "did:privy:user-1" }) as const,
    serviceToken: "service-secret",
  });

  const response = await handler(
    chatRequest({ role: "candidate", messages: [] }),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "missing-agent-url" });
});
