import assert from "node:assert/strict";
import test from "node:test";

import { MATCHING_SCORING_VERSION } from "@shire/shared";

import { RecommendationScheduler } from "../src/runtime/jobs/recommendation-scheduler";
import type { JobRequest } from "../src/runtime/jobs/job-contracts";
import type { RecommendationSchedulerRepository } from "../src/runtime/jobs/recommendation-scheduler";
import { shouldReconcileMatchingPair } from "../src/runtime/matching/fingerprint";
import { createInMemoryMatchingRepository } from "../src/runtime/matching/repository";

function createRepository(): RecommendationSchedulerRepository {
  const current = new Set<string>();
  const pairs = [
    {
      candidateId: "candidate-001",
      jobId: "job-001",
      inputHash: "fingerprint-001",
    },
    {
      candidateId: "candidate-002",
      jobId: "job-001",
      inputHash: "fingerprint-002",
    },
  ];
  return {
    async reconcileMatchingPairs() {
      const work = pairs.filter(
        (pair) => !current.has(`${pair.candidateId}:${pair.jobId}:${pair.inputHash}`),
      );
      return {
        pairs: work,
        scannedPairs: pairs.length,
        skippedPairs: pairs.length - work.length,
      };
    },
    async expireUnavailableRecommendations() {
      return 0;
    },
    markCurrent(request: Extract<JobRequest, { name: "matching-pair" }>) {
      current.add(
        `${request.payload.candidateId}:${request.payload.jobId}:${request.payload.inputHash}`,
      );
    },
  } as RecommendationSchedulerRepository & {
    markCurrent(request: Extract<JobRequest, { name: "matching-pair" }>): void;
  };
}

test("reconciles only stale or retryable matching evaluation states", () => {
  const now = new Date("2026-06-30T12:00:00.000Z");
  const evaluation = {
    inputHash: "current-hash",
    scoringVersion: MATCHING_SCORING_VERSION,
    status: "COMPLETED" as const,
    failureCode: null,
    updatedAt: now,
  };

  assert.equal(shouldReconcileMatchingPair("current-hash", null, now), true);
  assert.equal(
    shouldReconcileMatchingPair(
      "changed-hash",
      evaluation,
      now,
    ),
    true,
  );
  assert.equal(
    shouldReconcileMatchingPair(
      "current-hash",
      { ...evaluation, scoringVersion: "matching-v0" },
      now,
    ),
    true,
  );
  assert.equal(
    shouldReconcileMatchingPair(
      "current-hash",
      { ...evaluation, status: "PENDING" },
      now,
    ),
    true,
  );
  assert.equal(
    shouldReconcileMatchingPair(
      "current-hash",
      {
        ...evaluation,
        status: "FAILED",
        failureCode: "RETRYABLE:timeout",
      },
      now,
    ),
    true,
  );
  assert.equal(
    shouldReconcileMatchingPair(
      "current-hash",
      {
        ...evaluation,
        status: "RUNNING",
        updatedAt: new Date("2026-06-30T11:54:59.999Z"),
      },
      now,
    ),
    true,
  );
  assert.equal(
    shouldReconcileMatchingPair("current-hash", evaluation, now),
    false,
  );
  assert.equal(
    shouldReconcileMatchingPair(
      "current-hash",
      {
        ...evaluation,
        status: "RUNNING",
        updatedAt: new Date("2026-06-30T11:59:00.000Z"),
      },
      now,
    ),
    false,
  );
  assert.equal(
    shouldReconcileMatchingPair(
      "current-hash",
      {
        ...evaluation,
        status: "FAILED",
        failureCode: "FINAL:invalid",
      },
      now,
    ),
    false,
  );
});

test("expires both recommendation audiences in bounded unavailable-pair batches", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate({
    userId: "candidate-001",
    skills: ["TypeScript"],
    preferredRoles: ["Engineer"],
    profileStatus: "CONFIRMED",
  });
  repository.seedJob({
    id: "job-001",
    recruiterUserId: "recruiter-001",
    title: "Engineer",
    description: "Build",
    companyName: "Shire",
    location: "Remote",
    remote: true,
    salaryRange: "$100k",
    jobType: "FULL_TIME",
    experienceLevel: "MID",
    skillsRequired: ["TypeScript"],
    status: "ACTIVE",
    riskLevel: "LOW",
    riskScore: 0,
  });
  repository.seedEvaluation({
    candidateUserId: "candidate-001",
    jobId: "job-001",
    inputHash: "fingerprint-001",
    scoringVersion: MATCHING_SCORING_VERSION,
    status: "COMPLETED",
    attemptCount: 1,
  });
  const publication = {
    candidateUserId: "candidate-001",
    jobId: "job-001",
    recruiterUserId: "recruiter-001",
    matchScore: 90,
    confidence: 0.9,
    reasons: ["Strong fit"],
    missingRequirements: [],
    riskFlags: [],
    recommendedAction: "SUGGEST_APPLY" as const,
  };
  await repository.repairRecommendations({
    candidateUserId: "candidate-001",
    jobId: "job-001",
    inputHash: "fingerprint-001",
    scoringVersion: MATCHING_SCORING_VERSION,
    attemptCount: 1,
    recommendations: [
      { ...publication, type: "JOB_TO_CANDIDATE" },
      {
        ...publication,
        type: "TALENT_TO_COMPANY",
        recommendedAction: "SUGGEST_INVITE",
      },
    ],
  });
  repository.seedCandidate({
    userId: "candidate-001",
    skills: ["TypeScript"],
    preferredRoles: ["Engineer"],
    profileStatus: "DRAFT",
  });

  const first = await repository.expireUnavailableRecommendations({
    limit: 1,
    updatedBefore: new Date(),
  });
  const second = await repository.expireUnavailableRecommendations({
    limit: 1,
    updatedBefore: new Date(),
  });

  assert.equal(first, 1);
  assert.equal(second, 1);
  assert.deepEqual(
    repository
      .snapshotRecommendations()
      .map((recommendation) => recommendation.status),
    ["EXPIRED", "EXPIRED"],
  );
});

test("recommendation scheduler enqueues each canonical pair once", async () => {
  const enqueued: JobRequest[] = [];
  const repository = createRepository() as RecommendationSchedulerRepository & {
    markCurrent(request: Extract<JobRequest, { name: "matching-pair" }>): void;
  };
  const scheduler = new RecommendationScheduler({
    enabled: true,
    intervalMs: 15 * 60 * 1000,
    getRepository: () => repository,
    enqueue: async (request) => {
      enqueued.push(request);
      if (request.name === "matching-pair") {
        repository.markCurrent(request);
      }
      return { deduplicated: false };
    },
  });

  const first = await scheduler.runOnce();
  const second = await scheduler.runOnce();

  assert.deepEqual(first, {
    status: "queued",
    pairJobs: 2,
    skipped: 0,
    deduplicated: 0,
    expiredRecommendations: 0,
  });
  assert.deepEqual(second, {
    status: "queued",
    pairJobs: 0,
    skipped: 2,
    deduplicated: 0,
    expiredRecommendations: 0,
  });
  assert.deepEqual(enqueued, [
    {
      name: "matching-pair",
      payload: {
        candidateId: "candidate-001",
        jobId: "job-001",
        inputHash: "fingerprint-001",
      },
      deduplicationKey:
        "matching-pair:candidate-001:job-001:fingerprint-001",
    },
    {
      name: "matching-pair",
      payload: {
        candidateId: "candidate-002",
        jobId: "job-001",
        inputHash: "fingerprint-002",
      },
      deduplicationKey:
        "matching-pair:candidate-002:job-001:fingerprint-002",
    },
  ]);
  assert.equal(
    enqueued.some(
      (request) =>
        request.name === "job-matching" ||
        request.name === "talent-matching",
    ),
    false,
  );
});

test("recommendation scheduler skips when database is unavailable", async () => {
  const enqueued: JobRequest[] = [];
  const scheduler = new RecommendationScheduler({
    enabled: true,
    intervalMs: 15 * 60 * 1000,
    getRepository: () => undefined,
    enqueue: async (request) => {
      enqueued.push(request);
    },
  });

  const result = await scheduler.runOnce();

  assert.deepEqual(result, {
    status: "no-database",
    pairJobs: 0,
    skipped: 0,
    deduplicated: 0,
    expiredRecommendations: 0,
  });
  assert.deepEqual(enqueued, []);
});
