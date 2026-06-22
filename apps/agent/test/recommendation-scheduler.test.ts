import assert from "node:assert/strict";
import test from "node:test";

import { RecommendationScheduler } from "../src/runtime/jobs/recommendation-scheduler";
import type { JobRequest } from "../src/runtime/jobs/job-contracts";
import type { RecommendationSchedulerRepository } from "../src/runtime/jobs/recommendation-scheduler";

function createRepository(): RecommendationSchedulerRepository {
  return {
    async listConfirmedCandidates() {
      return [
        {
          userId: "candidate-001",
          skills: ["React"],
          preferredRoles: ["Frontend Engineer"],
          profileStatus: "CONFIRMED",
        },
        {
          userId: "candidate-002",
          skills: ["Solidity"],
          preferredRoles: ["Smart Contract Engineer"],
          profileStatus: "CONFIRMED",
        },
      ];
    },
    async listActiveJobs() {
      return [
        {
          id: "job-001",
          recruiterUserId: "recruiter-001",
          title: "Frontend Engineer",
          description: "Build UI",
          companyName: "Shire",
          location: "Remote",
          remote: true,
          salaryRange: "$100k",
          jobType: "FULL_TIME",
          experienceLevel: "MID",
          skillsRequired: ["React"],
          status: "ACTIVE",
          riskLevel: "LOW",
          riskScore: 5,
        },
      ];
    },
  };
}

test("recommendation scheduler enqueues candidate and talent matching jobs", async () => {
  const enqueued: JobRequest[] = [];
  const scheduler = new RecommendationScheduler({
    enabled: true,
    intervalMs: 15 * 60 * 1000,
    getRepository: createRepository,
    enqueue: async (request) => {
      enqueued.push(request);
    },
  });

  const result = await scheduler.runOnce();

  assert.deepEqual(result, {
    status: "queued",
    candidateJobs: 2,
    talentJobs: 1,
  });
  assert.deepEqual(enqueued, [
    { name: "job-matching", payload: { candidateId: "candidate-001" } },
    { name: "job-matching", payload: { candidateId: "candidate-002" } },
    { name: "talent-matching", payload: { jobId: "job-001" } },
  ]);
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
    candidateJobs: 0,
    talentJobs: 0,
  });
  assert.deepEqual(enqueued, []);
});

