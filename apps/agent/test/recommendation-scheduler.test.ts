import assert from "node:assert/strict";
import test from "node:test";

import { MATCHING_SCORING_VERSION } from "@shire/shared";

import { InMemoryJobQueue } from "../src/runtime/jobs/in-memory-job-queue";
import { RecommendationScheduler } from "../src/runtime/jobs/recommendation-scheduler";
import type { JobRequest } from "../src/runtime/jobs/job-contracts";
import type { RecommendationSchedulerRepository } from "../src/runtime/jobs/recommendation-scheduler";
import {
  MAX_MATCHING_EVALUATION_ATTEMPTS,
  matchingQueueGeneration,
  shouldReconcileMatchingPair,
} from "../src/runtime/matching/fingerprint";
import { createInMemoryMatchingRepository } from "../src/runtime/matching/repository";

function createRepository(): RecommendationSchedulerRepository {
  const current = new Set<string>();
  const pairs = [
    {
      candidateId: "candidate-001",
      jobId: "job-001",
      inputHash: "fingerprint-001",
      queueGeneration: 1,
    },
    {
      candidateId: "candidate-002",
      jobId: "job-001",
      inputHash: "fingerprint-002",
      queueGeneration: 1,
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
    attemptCount: 1,
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
        updatedAt: new Date(
          now.getTime() - 28_001,
        ),
      },
      now,
      28_000,
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
  assert.equal(
    shouldReconcileMatchingPair(
      "current-hash",
      {
        ...evaluation,
        status: "FAILED",
        failureCode: "RETRYABLE:timeout",
        attemptCount: MAX_MATCHING_EVALUATION_ATTEMPTS,
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
        status: "PENDING",
        attemptCount: MAX_MATCHING_EVALUATION_ATTEMPTS,
      },
      now,
    ),
    false,
  );
});

test("retryable reconciliation waits beyond the Bull backoff cooldown", () => {
  const now = new Date("2026-06-30T12:00:00.000Z");
  const retryCooldownMs = 28_000;
  const evaluation = {
    inputHash: "current-hash",
    scoringVersion: MATCHING_SCORING_VERSION,
    status: "FAILED" as const,
    failureCode: "RETRYABLE:timeout",
    attemptCount: 1,
    updatedAt: now,
  };

  assert.equal(
    shouldReconcileMatchingPair(
      "current-hash",
      evaluation,
      now,
      retryCooldownMs,
    ),
    false,
  );
  assert.equal(
    shouldReconcileMatchingPair(
      "current-hash",
      {
        ...evaluation,
        updatedAt: new Date(
          now.getTime() - retryCooldownMs,
        ),
      },
      now,
      retryCooldownMs,
    ),
    false,
  );
  assert.equal(
    shouldReconcileMatchingPair(
      "current-hash",
      {
        ...evaluation,
        updatedAt: new Date(
          now.getTime() - retryCooldownMs - 1,
        ),
      },
      now,
      retryCooldownMs,
    ),
    true,
  );
});

test("matching queue generation follows the canonical evaluation lifecycle", () => {
  const evaluation = {
    inputHash: "current-hash",
    scoringVersion: MATCHING_SCORING_VERSION,
    status: "FAILED" as const,
    failureCode: "RETRYABLE:timeout",
    attemptCount: 1,
    updatedAt: new Date(),
  };

  assert.equal(matchingQueueGeneration("current-hash", null), 1);
  assert.equal(matchingQueueGeneration("changed-hash", evaluation), 1);
  assert.equal(matchingQueueGeneration("current-hash", evaluation), 2);
});

test("retryable reconciliation emits a stable next-generation descriptor", async () => {
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
  const [initial] = (
    await repository.reconcileMatchingPairs({
      limit: 1,
      retryCooldownMs: 28_000,
    })
  ).pairs;
  assert.equal(initial?.queueGeneration, 1);
  repository.seedEvaluation({
    candidateUserId: "candidate-001",
    jobId: "job-001",
    inputHash: initial!.inputHash,
    scoringVersion: MATCHING_SCORING_VERSION,
    status: "FAILED",
    failureCode: "RETRYABLE:timeout",
    attemptCount: 1,
    updatedAt: new Date(
      Date.now() - 28_001,
    ),
  });

  const firstRetry = await repository.reconcileMatchingPairs({
    limit: 1,
    retryCooldownMs: 28_000,
  });
  const repeatedRetry = await repository.reconcileMatchingPairs({
    limit: 1,
    retryCooldownMs: 28_000,
  });

  assert.equal(firstRetry.pairs[0]?.queueGeneration, 2);
  assert.deepEqual(repeatedRetry.pairs, firstRetry.pairs);

  repository.seedEvaluation({
    candidateUserId: "candidate-001",
    jobId: "job-001",
    inputHash: initial!.inputHash,
    scoringVersion: MATCHING_SCORING_VERSION,
    status: "FAILED",
    failureCode: "RETRYABLE:timeout",
    attemptCount: MAX_MATCHING_EVALUATION_ATTEMPTS,
  });
  assert.deepEqual(
    (
      await repository.reconcileMatchingPairs({
        limit: 1,
        retryCooldownMs: 28_000,
      })
    ).pairs,
    [],
  );
});

test("expires both recommendation audiences in bounded unavailable-pair batches", async () => {
  let now = new Date("2026-06-30T12:00:00.000Z");
  const repository = createInMemoryMatchingRepository({ now: () => now });
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

  const fenced = await repository.expireUnavailableRecommendations({
    limit: 1,
    updatedBefore: now,
  });
  now = new Date(now.getTime() + 1);
  const first = await repository.expireUnavailableRecommendations({
    limit: 1,
    updatedBefore: now,
  });
  const second = await repository.expireUnavailableRecommendations({
    limit: 1,
    updatedBefore: now,
  });

  assert.equal(fenced, 0);
  assert.equal(first, 1);
  assert.equal(second, 1);
  assert.deepEqual(
    repository
      .snapshotRecommendations()
      .map((recommendation) => recommendation.status),
    ["EXPIRED", "EXPIRED"],
  );
});

test("unavailable cleanup does not expire recommendations reactivated before update", async () => {
  const timestamp = new Date("2026-06-30T12:00:00.000Z");
  let currentTime = timestamp;
  let repository: ReturnType<typeof createInMemoryMatchingRepository>;
  repository = createInMemoryMatchingRepository({
    now: () => currentTime,
    beforeRecommendationExpiration: () => {
      repository.seedCandidate({
        userId: "candidate-001",
        skills: ["TypeScript"],
        preferredRoles: ["Engineer"],
        profileStatus: "CONFIRMED",
      });
    },
  });
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
  currentTime = new Date(timestamp.getTime() + 2);

  const expired = await repository.expireUnavailableRecommendations({
    limit: 2,
    updatedBefore: new Date(timestamp.getTime() + 1),
  });

  assert.equal(expired, 0);
  assert.deepEqual(
    repository
      .snapshotRecommendations()
      .map((recommendation) => recommendation.status),
    ["NEW", "NEW"],
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
    retryCooldownMs: 0,
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
        "matching-pair:candidate-001:job-001:fingerprint-001:1",
    },
    {
      name: "matching-pair",
      payload: {
        candidateId: "candidate-002",
        jobId: "job-001",
        inputHash: "fingerprint-002",
      },
      deduplicationKey:
        "matching-pair:candidate-002:job-001:fingerprint-002:1",
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

test("enqueue failure retries the current reconciliation page before advancing", async () => {
  const seenCursors: Array<
    { candidateId: string; jobId: string } | undefined
  > = [];
  const pairs = [
    {
      candidateId: "candidate-001",
      jobId: "job-001",
      inputHash: "fingerprint-001",
      queueGeneration: 1,
    },
    {
      candidateId: "candidate-002",
      jobId: "job-001",
      inputHash: "fingerprint-002",
      queueGeneration: 1,
    },
  ];
  const repository: RecommendationSchedulerRepository = {
    async reconcileMatchingPairs(options) {
      seenCursors.push(options.cursor);
      return options.cursor
        ? {
            pairs: [],
            scannedPairs: 0,
            skippedPairs: 0,
          }
        : {
            pairs,
            scannedPairs: 2,
            skippedPairs: 0,
            nextCursor: {
              candidateId: "candidate-002",
              jobId: "job-001",
            },
          };
    },
    async expireUnavailableRecommendations() {
      return 0;
    },
  };
  const queued = new Set<string>();
  let secondPairFailures = 1;
  const scheduler = new RecommendationScheduler({
    enabled: true,
    intervalMs: 15 * 60 * 1000,
    retryCooldownMs: 0,
    getRepository: () => repository,
    enqueue: async (request) => {
      if (
        request.name === "matching-pair" &&
        request.payload.candidateId === "candidate-002" &&
        secondPairFailures > 0
      ) {
        secondPairFailures -= 1;
        throw new Error("queue unavailable");
      }
      const deduplicated = queued.has(request.deduplicationKey!);
      queued.add(request.deduplicationKey!);
      return { deduplicated };
    },
  });

  const failed = await scheduler.runOnce();
  const retried = await scheduler.runOnce();

  assert.equal(failed.status, "failed");
  assert.deepEqual(seenCursors, [undefined, undefined]);
  assert.deepEqual(retried, {
    status: "queued",
    pairJobs: 1,
    skipped: 0,
    deduplicated: 1,
    expiredRecommendations: 0,
  });
});

test("retained failed generation 1 does not block generation 2, which still deduplicates", async () => {
  const queue = new InMemoryJobQueue();
  const baseRequest = {
    name: "matching-pair" as const,
    payload: {
      candidateId: "candidate-001",
      jobId: "job-001",
      inputHash: "fingerprint-001",
    },
  };
  const generation1 = await queue.enqueue({
    ...baseRequest,
    deduplicationKey:
      "matching-pair:candidate-001:job-001:fingerprint-001:1",
  });
  await queue.markActive(generation1.id);
  await queue.markFailed(generation1.id, {
    code: "MATCHING_FAILED",
    message: "provider unavailable",
  });
  const repository: RecommendationSchedulerRepository = {
    async reconcileMatchingPairs() {
      return {
        pairs: [
          {
            ...baseRequest.payload,
            queueGeneration: 2,
          },
        ],
        scannedPairs: 1,
        skippedPairs: 0,
      };
    },
    async expireUnavailableRecommendations() {
      return 0;
    },
  };
  const scheduler = new RecommendationScheduler({
    enabled: true,
    intervalMs: 15 * 60 * 1000,
    retryCooldownMs: 0,
    getRepository: () => repository,
    enqueue: (request) => queue.enqueue(request),
  });

  const firstRetry = await scheduler.runOnce();
  const repeatedRetry = await scheduler.runOnce();

  assert.equal(firstRetry.pairJobs, 1);
  assert.equal(firstRetry.deduplicated, 0);
  assert.equal(repeatedRetry.pairJobs, 0);
  assert.equal(repeatedRetry.deduplicated, 1);
  assert.equal((await queue.get(generation1.id))?.status, "failed");
});

test("recommendation scheduler skips when database is unavailable", async () => {
  const enqueued: JobRequest[] = [];
  const scheduler = new RecommendationScheduler({
    enabled: true,
    intervalMs: 15 * 60 * 1000,
    retryCooldownMs: 0,
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
