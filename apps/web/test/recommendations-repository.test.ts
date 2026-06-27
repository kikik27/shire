import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryRecommendationsRepository } from "../lib/server/recommendations-repository";
import type { PersistedRecommendation } from "../lib/server/recommendations-repository";

function makeRecommendation(
  overrides: Partial<PersistedRecommendation>,
): PersistedRecommendation {
  const now = Date.now();
  return {
    id: overrides.id ?? crypto.randomUUID(),
    type: overrides.type ?? "JOB_TO_CANDIDATE",
    candidateUserId: overrides.candidateUserId ?? "candidate-1",
    recruiterUserId: overrides.recruiterUserId,
    jobId: overrides.jobId,
    matchScore: overrides.matchScore ?? 80,
    confidence: overrides.confidence,
    reasons: overrides.reasons ?? [],
    missingRequirements: overrides.missingRequirements ?? [],
    riskFlags: overrides.riskFlags ?? [],
    recommendedAction: overrides.recommendedAction ?? "SUGGEST_APPLY",
    status: overrides.status ?? "NEW",
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    candidate: overrides.candidate,
    job: overrides.job,
  };
}

test("in-memory candidate repository filters by type and candidate id", async () => {
  // The candidate route must never return recruiter talent rows. The drizzle
  // path enforces this with `type = 'JOB_TO_CANDIDATE'`; the in-memory path
  // mirrors the same filter. Both must reject talent rows even when the
  // `candidateUserId` matches.
  const repo = createInMemoryRecommendationsRepository();
  const candidateId = "candidate-1";

  repo.seed(
    makeRecommendation({
      candidateUserId: candidateId,
      type: "JOB_TO_CANDIDATE",
      matchScore: 90,
    }),
  );
  repo.seed(
    makeRecommendation({
      candidateUserId: candidateId,
      type: "TALENT_TO_COMPANY",
      matchScore: 95,
    }),
  );

  const result = await repo.listRecommendationsForCandidate(candidateId);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "JOB_TO_CANDIDATE");
  assert.equal(result[0].matchScore, 90);
});

test("in-memory recruiter repository filters by type and recruiter id", async () => {
  // Same guarantee for the recruiter route: only TALENT_TO_COMPANY rows
  // surface, even when JOB_TO_CANDIDATE rows are seeded for the same
  // recruiter user. The drizzle path enforces this with `type = 'TALENT_TO_COMPANY'`.
  const repo = createInMemoryRecommendationsRepository();
  const recruiterId = "recruiter-1";

  repo.seed(
    makeRecommendation({
      recruiterUserId: recruiterId,
      type: "TALENT_TO_COMPANY",
      matchScore: 88,
    }),
  );
  repo.seed(
    makeRecommendation({
      recruiterUserId: recruiterId,
      type: "JOB_TO_CANDIDATE",
      matchScore: 99,
    }),
  );

  const result = await repo.listRecommendationsForRecruiter(recruiterId);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "TALENT_TO_COMPANY");
  assert.equal(result[0].matchScore, 88);
});

test("in-memory candidate repository returns empty for unknown candidates", async () => {
  const repo = createInMemoryRecommendationsRepository();
  repo.seed(makeRecommendation({ candidateUserId: "candidate-1" }));
  const result = await repo.listRecommendationsForCandidate("candidate-2");
  assert.deepEqual(result, []);
});

test("in-memory recruiter repository returns empty for unknown recruiters", async () => {
  const repo = createInMemoryRecommendationsRepository();
  repo.seed(
    makeRecommendation({
      recruiterUserId: "recruiter-1",
      type: "TALENT_TO_COMPANY",
    }),
  );
  const result = await repo.listRecommendationsForRecruiter("recruiter-2");
  assert.deepEqual(result, []);
});

test("in-memory candidate repository preserves joined candidate and job summaries", async () => {
  // The repository hands the API the joined `candidate` and `job` summaries
  // produced by `mapCandidateSummary` / `mapJobSummary` so the dashboard can
  // render names and skills without an extra round-trip. The drizzle path
  // builds these from the join rows; the in-memory path stores them on the
  // seed. This test pins the surface shape so a refactor of either
  // transformation cannot silently drop a field that the UI relies on.
  const repo = createInMemoryRecommendationsRepository();
  const candidate = {
    displayName: "Sara Lindgren",
    headline: "Frontend Engineer",
    skills: ["React", "TypeScript"],
    roleTargets: ["Frontend Engineer"],
    location: "Remote",
  };
  const job = {
    title: "Frontend Engineer",
    companyName: "Shire Labs",
    location: "Remote",
    remote: true,
    experienceLevel: "SENIOR",
    skillsRequired: ["React", "TypeScript"],
  };

  repo.seed(
    makeRecommendation({
      candidateUserId: "candidate-1",
      candidate,
      job,
    }),
  );

  const result = await repo.listRecommendationsForCandidate("candidate-1");
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].candidate, candidate);
  assert.deepEqual(result[0].job, job);
});

test("in-memory candidate repository sorts by match score then creation time", async () => {
  // Stable ordering matters because the dashboard renders the first row as
  // the "top" recommendation. Equal match scores fall back to most recent
  // first (descending `createdAt`).
  const repo = createInMemoryRecommendationsRepository();
  const baseTime = Date.now();
  repo.seed(
    makeRecommendation({
      candidateUserId: "candidate-1",
      matchScore: 80,
      createdAt: baseTime + 100,
    }),
  );
  repo.seed(
    makeRecommendation({
      candidateUserId: "candidate-1",
      matchScore: 80,
      createdAt: baseTime + 300,
    }),
  );
  repo.seed(
    makeRecommendation({
      candidateUserId: "candidate-1",
      matchScore: 95,
      createdAt: baseTime + 50,
    }),
  );
  repo.seed(
    makeRecommendation({
      candidateUserId: "candidate-1",
      matchScore: 88,
      createdAt: baseTime + 200,
    }),
  );

  const result = await repo.listRecommendationsForCandidate("candidate-1");
  assert.deepEqual(
    result.map((row) => row.matchScore),
    [95, 88, 80, 80],
  );
  // The two matchScore:80 rows must be ordered most-recent-first.
  const tieBreak = result.filter((row) => row.matchScore === 80);
  assert.equal(tieBreak[0].createdAt, baseTime + 300);
  assert.equal(tieBreak[1].createdAt, baseTime + 100);
});