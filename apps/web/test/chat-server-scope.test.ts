import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuthenticatedChatContext,
  ChatScopeAuthorizationError,
} from "../lib/chat/server-scope";
import type { PersistedJob } from "../lib/server/jobs-repository";
import type { CandidateProfile, RecruiterProfile } from "../lib/types";

const candidateProfile: CandidateProfile = {
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
};

const recruiterProfile: RecruiterProfile = {
  companyName: "Aperture Labs",
  companyWebsite: "https://aperture.xyz",
  companyDescription: "Onchain identity tooling.",
  contactEmail: "talent@aperture.xyz",
  location: "Remote",
  verificationStatus: "VERIFIED",
  trustLevel: 88,
  completedHires: 12,
  disputeCount: 0,
};

function persistedJob(
  overrides: Partial<PersistedJob> = {},
): PersistedJob {
  return {
    id: "job-real-1",
    recruiterUserId: "recruiter-user",
    title: "Protocol Engineer",
    description: "Build trusted protocol integrations.",
    companyName: "Protocol Labs",
    location: "Remote",
    remote: true,
    salaryRange: "$140k-$180k",
    jobType: "FULL_TIME",
    experienceLevel: "SENIOR",
    skillsRequired: ["TypeScript", "Solidity"],
    status: "ACTIVE",
    stakeAmount: 100,
    stakeToken: "cUSD",
    candidateStakeRequired: false,
    riskLevel: "LOW",
    riskScore: 12,
    createdAt: 1,
    updatedAt: 1,
    expiresAt: 2,
    ...overrides,
  };
}

test("candidate can chat about a real active job with trusted job context", async () => {
  const job = persistedJob();
  const context = await buildAuthenticatedChatContext({
    userId: "candidate-user",
    role: "candidate",
    profile: candidateProfile,
    requestedScope: {
      role: "candidate",
      resourceType: "job",
      resourceId: job.id,
      resourceLabel: "Browser-controlled title",
    },
    resourceRepository: {
      getJob: async () => job,
    },
  });

  assert.equal(context.scope.resourceLabel, job.title);
  assert.match(context.system, /Job title: Protocol Engineer/);
  assert.match(context.system, /Company: Protocol Labs/);
  assert.match(context.system, /Description: Build trusted protocol integrations\./);
  assert.match(context.system, /Required skills: TypeScript, Solidity/);
  assert.match(context.system, /Job status: ACTIVE/);
  assert.doesNotMatch(context.system, /Browser-controlled title/);
});

test("candidate cannot use a non-active job context", async () => {
  const job = persistedJob({
    id: "job_fe_aperture",
    status: "DRAFT",
  });

  await assert.rejects(
    async () =>
      await buildAuthenticatedChatContext({
        userId: "candidate-user",
        role: "candidate",
        profile: candidateProfile,
        requestedScope: {
          role: "candidate",
          resourceType: "job",
          resourceId: job.id,
        },
        resourceRepository: {
          getJob: async () => job,
        },
      }),
    (error) =>
      error instanceof ChatScopeAuthorizationError &&
      error.code === "resource-forbidden",
  );
});

test("candidate cannot use an active job excluded from candidate listings", async () => {
  const job = persistedJob({
    recruiterUserId: "candidate-user",
  });

  await assert.rejects(
    async () =>
      await buildAuthenticatedChatContext({
        userId: "candidate-user",
        role: "candidate",
        profile: candidateProfile,
        requestedScope: {
          role: "candidate",
          resourceType: "job",
          resourceId: job.id,
        },
        resourceRepository: {
          getJob: async () => job,
        },
      }),
    (error) =>
      error instanceof ChatScopeAuthorizationError &&
      error.code === "resource-forbidden",
  );
});

test("candidate and recruiter resources differ for one user", async () => {
  const userId = "user-001";
  const candidate = await buildAuthenticatedChatContext({
    userId,
    role: "candidate",
    profile: candidateProfile,
    requestedScope: { role: "candidate" },
  });
  const recruiter = await buildAuthenticatedChatContext({
    userId,
    role: "recruiter",
    profile: recruiterProfile,
    requestedScope: { role: "recruiter" },
  });

  assert.equal(candidate.memory.resource, "user:user-001:role:candidate");
  assert.equal(recruiter.memory.resource, "user:user-001:role:recruiter");
  assert.notEqual(candidate.scope.resourceKey, recruiter.scope.resourceKey);
});

test("two users never receive the same resource or thread keys", async () => {
  const first = await buildAuthenticatedChatContext({
    userId: "user-001",
    role: "candidate",
    profile: candidateProfile,
    requestedScope: { role: "candidate", resourceType: "candidate" },
  });
  const second = await buildAuthenticatedChatContext({
    userId: "user-002",
    role: "candidate",
    profile: candidateProfile,
    requestedScope: { role: "candidate", resourceType: "candidate" },
  });

  assert.notEqual(first.memory.resource, second.memory.resource);
  assert.notEqual(first.memory.thread, second.memory.thread);
});

test("browser viewerId and memory keys are ignored", async () => {
  const context = await buildAuthenticatedChatContext({
    userId: "user-real",
    role: "candidate",
    profile: candidateProfile,
    requestedScope: {
      role: "candidate",
      resourceType: "candidate",
      resourceId: "candidate-001",
      viewerId: "candidate-001",
      threadId: "candidate:candidate-001:general",
      resourceKey: "candidate:candidate-001:general",
    },
  });

  assert.equal(context.scope.viewerId, "user-real");
  assert.equal(context.scope.resourceId, "user-real");
  assert.equal(context.memory.resource, "user:user-real:role:candidate");
  assert.equal(context.memory.thread, "user:user-real:role:candidate:candidate:user-real");
});

test("candidate trusted context includes the saved display name", async () => {
  const context = await buildAuthenticatedChatContext({
    userId: "user-001",
    role: "candidate",
    profile: candidateProfile,
    requestedScope: { role: "candidate" },
  });

  assert.match(context.system, /M\. Zaky Arisandhi/);
  assert.doesNotMatch(context.system, /\$120k/);
});

test("an inactive role is rejected", async () => {
  await assert.rejects(
    async () =>
      await buildAuthenticatedChatContext({
        userId: "user-001",
        role: "recruiter",
        profile: null,
        requestedScope: { role: "recruiter" },
      }),
    (error) =>
      error instanceof ChatScopeAuthorizationError &&
      error.code === "role-not-active",
  );
});

test("candidate self-profile scope uses the authenticated user UUID", async () => {
  const context = await buildAuthenticatedChatContext({
    userId: "user-001",
    role: "candidate",
    profile: candidateProfile,
    requestedScope: {
      role: "candidate",
      resourceType: "candidate",
      resourceId: "candidate-001",
      resourceLabel: "Browser Name",
    },
  });

  assert.equal(context.scope.resourceId, "user-001");
  assert.equal(context.scope.resourceLabel, "M. Zaky Arisandhi");
  assert.equal(context.scope.threadId, "user:user-001:role:candidate:candidate:user-001");
});
