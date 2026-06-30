import assert from "node:assert/strict";
import test from "node:test";

import { MATCHING_EVALUATION_STATUSES } from "@shire/shared";
import { getTableConfig, PgDialect, type PgTable } from "drizzle-orm/pg-core";

import {
  matchingEvaluationStatusEnum as agentMatchingEvaluationStatusEnum,
  matchingEvaluations as agentMatchingEvaluations,
} from "../src/runtime/db/schema";
import {
  classifyEvaluationClaimConflict,
  createInMemoryMatchingRepository,
  mapCandidateProfileForMatching,
  parsePersistedRecommendedAction,
  RUNNING_EVALUATION_LEASE_MS,
} from "../src/runtime/matching/repository";
import { evaluateMatchingPair } from "../src/runtime/matching/evaluation";
import { createMatchingFingerprint } from "../src/runtime/matching/fingerprint";
import {
  runJobMatchingForCandidate,
  runTalentMatchingForJob,
} from "../src/runtime/matching/pipeline";
import { fallbackOutput, rerankMatch } from "../src/runtime/matching/rerank";
import { scoreMatch } from "../src/runtime/matching/rule-score";
import type { CandidateMatchInput, JobMatchInput } from "../src/runtime/matching/types";
import {
  matchingEvaluationStatusEnum as webMatchingEvaluationStatusEnum,
  matchingEvaluations as webMatchingEvaluations,
} from "../../web/lib/server/db/schema";

function matchingEvaluationTableContract(table: PgTable) {
  const config = getTableConfig(table);
  const dialect = new PgDialect();

  return {
    name: config.name,
    confidenceMode: config.columns.find(
      (column) => column.name === "confidence",
    )?.dataType,
    columns: config.columns.map((column) => ({
      name: column.name,
      type: column.columnType,
      notNull: column.notNull,
      hasDefault: column.default !== undefined,
    })),
    indexes: config.indexes.map((tableIndex) => ({
      name: tableIndex.config.name,
      columns: tableIndex.config.columns.map((column) => column.name),
      unique: tableIndex.config.unique,
    })),
    foreignKeys: config.foreignKeys.map((foreignKey) => {
      const reference = foreignKey.reference();
      return {
        columns: reference.columns.map((column) => column.name),
        foreignColumns: reference.foreignColumns.map((column) => column.name),
        foreignTable: getTableConfig(reference.foreignTable).name,
        onDelete: foreignKey.onDelete,
      };
    }),
    checks: config.checks.map((constraint) => ({
      name: constraint.name,
      sql: dialect.sqlToQuery(constraint.value).sql,
    })),
  };
}

test("matching evaluation schemas share the canonical persisted record contract", () => {
  const agentContract = matchingEvaluationTableContract(agentMatchingEvaluations);
  const webContract = matchingEvaluationTableContract(webMatchingEvaluations);

  assert.deepEqual(agentMatchingEvaluationStatusEnum.enumValues, [
    ...MATCHING_EVALUATION_STATUSES,
  ]);
  assert.deepEqual(webMatchingEvaluationStatusEnum.enumValues, [
    ...MATCHING_EVALUATION_STATUSES,
  ]);
  assert.deepEqual(agentContract, webContract);
  assert.deepEqual(agentContract, {
    name: "matching_evaluations",
    confidenceMode: "number",
    columns: [
      { name: "id", type: "PgUUID", notNull: true, hasDefault: true },
      {
        name: "candidate_user_id",
        type: "PgUUID",
        notNull: true,
        hasDefault: false,
      },
      { name: "job_id", type: "PgUUID", notNull: true, hasDefault: false },
      { name: "input_hash", type: "PgText", notNull: true, hasDefault: false },
      {
        name: "scoring_version",
        type: "PgText",
        notNull: true,
        hasDefault: false,
      },
      {
        name: "status",
        type: "PgEnumColumn",
        notNull: true,
        hasDefault: false,
      },
      {
        name: "rule_score",
        type: "PgInteger",
        notNull: false,
        hasDefault: false,
      },
      {
        name: "match_score",
        type: "PgInteger",
        notNull: false,
        hasDefault: false,
      },
      {
        name: "confidence",
        type: "PgNumericNumber",
        notNull: false,
        hasDefault: false,
      },
      {
        name: "recommended_action",
        type: "PgText",
        notNull: false,
        hasDefault: false,
      },
      { name: "reasons", type: "PgJsonb", notNull: true, hasDefault: true },
      {
        name: "missing_requirements",
        type: "PgJsonb",
        notNull: true,
        hasDefault: true,
      },
      { name: "risk_flags", type: "PgJsonb", notNull: true, hasDefault: true },
      {
        name: "failure_code",
        type: "PgText",
        notNull: false,
        hasDefault: false,
      },
      {
        name: "attempt_count",
        type: "PgInteger",
        notNull: true,
        hasDefault: true,
      },
      {
        name: "created_at",
        type: "PgTimestamp",
        notNull: true,
        hasDefault: true,
      },
      {
        name: "updated_at",
        type: "PgTimestamp",
        notNull: true,
        hasDefault: true,
      },
    ],
    indexes: [
      {
        name: "matching_evaluations_candidate_job_unique",
        columns: ["candidate_user_id", "job_id"],
        unique: true,
      },
      {
        name: "matching_evaluations_status_idx",
        columns: ["status"],
        unique: false,
      },
      {
        name: "matching_evaluations_updated_at_idx",
        columns: ["updated_at"],
        unique: false,
      },
    ],
    foreignKeys: [
      {
        columns: ["candidate_user_id"],
        foreignColumns: ["id"],
        foreignTable: "app_users",
        onDelete: "cascade",
      },
      {
        columns: ["job_id"],
        foreignColumns: ["id"],
        foreignTable: "jobs",
        onDelete: "cascade",
      },
    ],
    checks: [
      {
        name: "matching_evaluations_confidence_range_check",
        sql: '"matching_evaluations"."confidence" is null or "matching_evaluations"."confidence" between 0 and 1',
      },
      {
        name: "matching_evaluations_rule_score_range_check",
        sql: '"matching_evaluations"."rule_score" is null or "matching_evaluations"."rule_score" between 0 and 100',
      },
      {
        name: "matching_evaluations_match_score_range_check",
        sql: '"matching_evaluations"."match_score" is null or "matching_evaluations"."match_score" between 0 and 100',
      },
      {
        name: "matching_evaluations_attempt_count_nonnegative_check",
        sql: '"matching_evaluations"."attempt_count" >= 0',
      },
    ],
  });
});

function candidate(overrides: Partial<CandidateMatchInput> = {}): CandidateMatchInput {
  return {
    userId: "candidate-1",
    fullName: "Maya Okafor",
    headline: "Senior Frontend Engineer",
    skills: ["typescript", "react", "design-systems"],
    preferredRoles: ["senior frontend engineer"],
    location: "Jakarta",
    workPreference: "remote",
    portfolioUrl: "https://maya.example",
    githubUrl: "https://github.com/maya",
    yearsExperience: 6,
    profileStatus: "CONFIRMED",
    ...overrides,
  };
}

function job(overrides: Partial<JobMatchInput> = {}): JobMatchInput {
  return {
    id: "job-1",
    recruiterUserId: "recruiter-1",
    title: "Senior Frontend Engineer",
    description: "Build product UI.",
    companyName: "Acme",
    location: "Jakarta",
    remote: true,
    salaryRange: "120000-160000",
    jobType: "FULL_TIME",
    experienceLevel: "SENIOR",
    skillsRequired: ["typescript", "react"],
    status: "ACTIVE",
    riskLevel: "LOW",
    riskScore: 10,
    ...overrides,
  };
}

/** Mock rerank agents that always return the deterministic fallback (no LLM). */
function fallbackAgents() {
  const fakeAgent = {
    async generate() {
      return { object: undefined };
    },
  };
  return { jobAgent: fakeAgent, talentAgent: fakeAgent };
}

test("job matching saves a recommendation for a strong candidate/job pair", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate(candidate());
  repository.seedJob(job());

  const result = await runJobMatchingForCandidate(
    repository,
    "candidate-1",
    fallbackAgents(),
  );

  assert.equal(result.direction, "candidate-to-job");
  assert.equal(result.saved.length, 1);
  assert.equal(result.saved[0].candidateUserId, "candidate-1");
  assert.equal(result.saved[0].jobId, "job-1");
  assert.ok(result.saved[0].matchScore >= 70);
  assert.equal(result.llmInvoked, false);

  const snapshot = repository.snapshotRecommendations();
  assert.deepEqual(
    snapshot.map((recommendation) => recommendation.type).sort(),
    ["JOB_TO_CANDIDATE", "TALENT_TO_COMPANY"],
  );
});

test("job matching skips the candidate's own jobs", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate(candidate());
  repository.seedJob(job({ id: "own-job", recruiterUserId: "candidate-1" }));

  const result = await runJobMatchingForCandidate(
    repository,
    "candidate-1",
    fallbackAgents(),
  );

  assert.equal(result.saved.length, 0);
});

test("job matching skips jobs the candidate already applied to", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate(candidate());
  repository.seedJob(job());
  repository.seedApplication("candidate-1", "job-1");

  const result = await runJobMatchingForCandidate(
    repository,
    "candidate-1",
    fallbackAgents(),
  );

  assert.equal(result.saved.length, 0);
});

test("job matching skips non-confirmed candidates", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate(candidate({ profileStatus: "PENDING_REVIEW" }));
  repository.seedJob(job());

  const result = await runJobMatchingForCandidate(
    repository,
    "candidate-1",
    fallbackAgents(),
  );

  assert.equal(result.evaluated, 0);
  assert.equal(result.saved.length, 0);
});

test("job matching ignores pairs scoring below the save threshold", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate(
    candidate({ skills: ["cobol", "fortran"], yearsExperience: 0, preferredRoles: [] }),
  );
  repository.seedJob(job());

  const result = await runJobMatchingForCandidate(
    repository,
    "candidate-1",
    fallbackAgents(),
  );

  assert.equal(result.saved.length, 0);
});

test("talent matching saves recommendations for an active job's candidates", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate(candidate());
  repository.seedJob(job());

  const result = await runTalentMatchingForJob(
    repository,
    "job-1",
    fallbackAgents(),
  );

  assert.equal(result.direction, "job-to-candidate");
  assert.equal(result.saved.length, 1);
  assert.equal(result.saved[0].jobId, "job-1");

  const snapshot = repository.snapshotRecommendations();
  assert.deepEqual(
    snapshot.map((recommendation) => recommendation.type).sort(),
    ["JOB_TO_CANDIDATE", "TALENT_TO_COMPANY"],
  );
});

test("talent matching skips an inactive job", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate(candidate());
  repository.seedJob(job({ status: "DRAFT" }));

  const result = await runTalentMatchingForJob(
    repository,
    "job-1",
    fallbackAgents(),
  );

  assert.equal(result.evaluated, 0);
  assert.equal(result.saved.length, 0);
});

test("matching maps web-saved candidate profile fields", () => {
  const mapped = mapCandidateProfileForMatching({
    userId: "candidate-1",
    profileStatus: "CONFIRMED",
    profile: {
      displayName: "Maya Okafor",
      bio: "Senior frontend engineer",
      skills: ["TypeScript", "React"],
      roleTargets: ["Frontend Engineer"],
      experienceLevel: "SENIOR",
      salaryExpectation: "$120k-$160k",
      location: "Jakarta",
      portfolioUrl: "https://maya.example",
    },
  });

  assert.equal(mapped.fullName, "Maya Okafor");
  assert.equal(mapped.summary, "Senior frontend engineer");
  assert.deepEqual(mapped.preferredRoles, ["Frontend Engineer"]);
  assert.equal(mapped.yearsExperience, 5);
  assert.deepEqual(mapped.expectedSalary, {
    min: 120000,
    max: 160000,
    currency: undefined,
  });
});

test("fallback output derives the recommended action from the rule score", () => {
  const high = fallbackOutput(
    { ...scoreMatch(candidate(), job()), score: 90 } as never,
    "job-rerank",
  );
  assert.equal(high.recommendedAction, "SUGGEST_APPLY");

  const strongTalent = fallbackOutput(
    { ...scoreMatch(candidate(), job()), score: 90 } as never,
    "talent-rerank",
  );
  assert.equal(strongTalent.recommendedAction, "SUGGEST_INVITE");

  const mid = fallbackOutput(
    { ...scoreMatch(candidate(), job()), score: 75 } as never,
    "job-rerank",
  );
  assert.equal(mid.recommendedAction, "SAVE_ONLY");

  const low = fallbackOutput(
    { ...scoreMatch(candidate(), job()), score: 40 } as never,
    "job-rerank",
  );
  assert.equal(low.recommendedAction, "IGNORE");
});

test("rerank parses JSON text for direct model providers", async () => {
  const ruleScore = scoreMatch(candidate(), job());
  let structuredOutputWasSent = false;
  const fakeAgent = {
    async generate(_messages: unknown, options: { structuredOutput?: unknown }) {
      structuredOutputWasSent = "structuredOutput" in options;
      return {
        text: JSON.stringify({
          matchScore: 88,
          confidence: 0.8,
          reasons: ["Strong skill overlap"],
          missingRequirements: [],
          riskFlags: [],
          recommendedAction: "SUGGEST_INVITE",
        }),
      };
    },
  };

  const result = await rerankMatch(
    candidate(),
    job(),
    ruleScore,
    "talent-rerank",
    { talentAgent: fakeAgent },
  );

  assert.equal(result.llmInvoked, true);
  assert.equal(structuredOutputWasSent, false);
  assert.equal(result.output.matchScore, 88);
  assert.equal(result.output.recommendedAction, "SUGGEST_INVITE");
});

test("completed unchanged pairs skip reranking", async () => {
  const repository = createInMemoryMatchingRepository();
  const candidateInput = candidate();
  const jobInput = job();
  repository.seedCandidate(candidateInput);
  repository.seedJob(jobInput);
  repository.seedEvaluation({
    candidateUserId: candidateInput.userId,
    jobId: jobInput.id,
    inputHash: createMatchingFingerprint(candidateInput, jobInput, {
      hasApplied: false,
    }),
    status: "COMPLETED",
    attemptCount: 1,
  });
  let rerankCalls = 0;

  const result = await evaluateMatchingPair(
    repository,
    { candidateUserId: candidateInput.userId, jobId: jobInput.id },
    {
      rerank: async () => {
        rerankCalls += 1;
        throw new Error("must not rerank");
      },
    },
  );

  assert.equal(result.status, "unchanged");
  assert.equal(rerankCalls, 0);
});

test("below-threshold pairs are completed and skipped when unchanged", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate(
    candidate({
      skills: ["cobol"],
      preferredRoles: [],
      yearsExperience: 0,
      portfolioUrl: undefined,
      githubUrl: undefined,
      linkedinUrl: undefined,
    }),
  );
  repository.seedJob(job());
  let rerankCalls = 0;
  const dependencies = {
    rerank: async () => {
      rerankCalls += 1;
      throw new Error("below-threshold pair must not rerank");
    },
  };

  const first = await evaluateMatchingPair(
    repository,
    { candidateUserId: "candidate-1", jobId: "job-1" },
    dependencies,
  );
  const second = await evaluateMatchingPair(
    repository,
    { candidateUserId: "candidate-1", jobId: "job-1" },
    dependencies,
  );

  assert.equal(first.status, "completed");
  assert.equal(first.recommended, false);
  assert.equal(second.status, "unchanged");
  assert.equal(rerankCalls, 0);
  assert.equal(repository.snapshotEvaluations()[0]?.status, "COMPLETED");
});

test("changed matching input reranks and upserts both recommendation directions once", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate(candidate());
  repository.seedJob(job());
  let rerankCalls = 0;
  const dependencies = {
    rerank: async () => {
      rerankCalls += 1;
      return {
        output: {
          matchScore: 90,
          confidence: 0.9,
          reasons: ["strong fit"],
          missingRequirements: [],
          riskFlags: [],
          recommendedAction: "SUGGEST_APPLY" as const,
        },
        llmInvoked: true,
      };
    },
  };

  const first = await evaluateMatchingPair(
    repository,
    { candidateUserId: "candidate-1", jobId: "job-1" },
    dependencies,
  );
  const unchanged = await evaluateMatchingPair(
    repository,
    { candidateUserId: "candidate-1", jobId: "job-1" },
    dependencies,
  );
  const initialRecommendations = repository.snapshotRecommendations();
  repository.seedCandidate(candidate({ headline: "Staff Frontend Engineer" }));
  const changed = await evaluateMatchingPair(
    repository,
    { candidateUserId: "candidate-1", jobId: "job-1" },
    dependencies,
  );
  const updatedRecommendations = repository.snapshotRecommendations();

  assert.equal(first.status, "completed");
  assert.equal(first.recommended, true);
  assert.equal(unchanged.status, "unchanged");
  assert.equal(changed.status, "completed");
  assert.equal(rerankCalls, 2);
  assert.equal(updatedRecommendations.length, 2);
  assert.deepEqual(
    updatedRecommendations.map(({ id }) => id).sort(),
    initialRecommendations.map(({ id }) => id).sort(),
  );
  assert.equal(repository.snapshotEvaluations()[0]?.attemptCount, 2);
});

test("newly ineligible input expires both recommendation directions", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate(candidate());
  repository.seedJob(job());
  const dependencies = {
    rerank: async () => ({
      output: {
        matchScore: 90,
        confidence: 0.9,
        reasons: ["strong fit"],
        missingRequirements: [],
        riskFlags: [],
        recommendedAction: "SUGGEST_APPLY" as const,
      },
      llmInvoked: false,
    }),
  };
  await evaluateMatchingPair(
    repository,
    { candidateUserId: "candidate-1", jobId: "job-1" },
    dependencies,
  );

  repository.seedJob(job({ recruiterUserId: "candidate-1" }));
  const result = await evaluateMatchingPair(
    repository,
    { candidateUserId: "candidate-1", jobId: "job-1" },
    dependencies,
  );

  assert.equal(result.status, "ineligible");
  assert.equal(result.recommended, false);
  assert.equal(repository.snapshotEvaluations()[0]?.status, "COMPLETED");
  assert.deepEqual(
    repository.snapshotRecommendations().map(({ status }) => status),
    ["EXPIRED", "EXPIRED"],
  );
});

test("missing active entity leaves cleanup to pair reconciliation", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate(candidate());
  repository.seedJob(job());
  await evaluateMatchingPair(
    repository,
    { candidateUserId: "candidate-1", jobId: "job-1" },
    {
      rerank: async () => ({
        output: {
          matchScore: 90,
          confidence: 0.9,
          reasons: ["strong fit"],
          missingRequirements: [],
          riskFlags: [],
          recommendedAction: "SUGGEST_APPLY",
        },
        llmInvoked: true,
      }),
    },
  );
  repository.seedJob(job({ status: "DRAFT" }));

  const missing = await evaluateMatchingPair(repository, {
    candidateUserId: "candidate-1",
    jobId: "job-1",
  });
  const unchanged = await evaluateMatchingPair(repository, {
    candidateUserId: "candidate-1",
    jobId: "job-1",
  });

  assert.equal(missing.status, "ineligible");
  assert.equal(missing.claimed, false);
  assert.equal(unchanged.status, "ineligible");
  assert.equal(repository.snapshotEvaluations()[0]?.status, "COMPLETED");
  assert.equal(repository.snapshotEvaluations()[0]?.attemptCount, 1);
  assert.deepEqual(
    repository.snapshotRecommendations().map(({ status }) => status),
    ["NEW", "NEW"],
  );
});

test("applying after recommendation completes a new ineligible evaluation without reactivation", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate(candidate());
  repository.seedJob(job());
  let rerankCalls = 0;
  const dependencies = {
    rerank: async () => {
      rerankCalls += 1;
      return {
        output: {
          matchScore: 90,
          confidence: 0.9,
          reasons: ["strong fit"],
          missingRequirements: [],
          riskFlags: [],
          recommendedAction: "SUGGEST_APPLY" as const,
        },
        llmInvoked: true,
      };
    },
  };

  await evaluateMatchingPair(
    repository,
    { candidateUserId: "candidate-1", jobId: "job-1" },
    dependencies,
  );
  repository.seedApplication("candidate-1", "job-1");

  const applied = await evaluateMatchingPair(
    repository,
    { candidateUserId: "candidate-1", jobId: "job-1" },
    dependencies,
  );
  const unchanged = await evaluateMatchingPair(
    repository,
    { candidateUserId: "candidate-1", jobId: "job-1" },
    dependencies,
  );

  assert.equal(applied.status, "ineligible");
  assert.equal(unchanged.status, "unchanged");
  assert.equal(rerankCalls, 1);
  assert.equal(repository.snapshotEvaluations()[0]?.status, "COMPLETED");
  assert.equal(repository.snapshotEvaluations()[0]?.attemptCount, 2);
  assert.deepEqual(
    repository.snapshotRecommendations().map(({ status }) => status),
    ["EXPIRED", "EXPIRED"],
  );
});

test("pair evaluation reuses one application lookup for versioning and filtering", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate(candidate());
  repository.seedJob(job());
  const listAppliedJobIds = repository.listAppliedJobIds.bind(repository);
  let applicationReads = 0;
  repository.listAppliedJobIds = async (candidateUserId) => {
    applicationReads += 1;
    return listAppliedJobIds(candidateUserId);
  };

  await evaluateMatchingPair(
    repository,
    { candidateUserId: "candidate-1", jobId: "job-1" },
    {
      rerank: async () => ({
        output: {
          matchScore: 80,
          confidence: 0.8,
          reasons: [],
          missingRequirements: [],
          riskFlags: [],
          recommendedAction: "SAVE_ONLY",
        },
        llmInvoked: false,
      }),
    },
  );

  assert.equal(applicationReads, 1);
});

test("pending evaluations are unprocessed and claim attempt one", async () => {
  const repository = createInMemoryMatchingRepository();
  const pair = { candidateUserId: "candidate-1", jobId: "job-1" };
  repository.seedEvaluation({
    ...pair,
    inputHash: "hash-1",
    status: "PENDING",
    attemptCount: 0,
  });

  const claimed = await repository.claimEvaluation({
    ...pair,
    inputHash: "hash-1",
    scoringVersion: "matching-v1",
  });

  assert.equal(claimed.status, "claimed");
  if (claimed.status !== "claimed") {
    assert.fail("expected pending evaluation to be claimed");
  }
  assert.equal(claimed.claim.attemptCount, 1);
  assert.equal(repository.snapshotEvaluations()[0]?.status, "RUNNING");
});

test("reactivating an unavailable pair keeps its unchanged evaluation", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate(candidate());
  repository.seedJob(job());
  let rerankCalls = 0;
  const dependencies = {
    rerank: async () => {
      rerankCalls += 1;
      return {
        output: {
          matchScore: 90,
          confidence: 0.9,
          reasons: ["strong fit"],
          missingRequirements: [],
          riskFlags: [],
          recommendedAction: "SUGGEST_APPLY" as const,
        },
        llmInvoked: true,
      };
    },
  };
  await evaluateMatchingPair(
    repository,
    { candidateUserId: "candidate-1", jobId: "job-1" },
    dependencies,
  );
  repository.seedJob(job({ status: "DRAFT" }));
  await evaluateMatchingPair(
    repository,
    { candidateUserId: "candidate-1", jobId: "job-1" },
    dependencies,
  );
  repository.seedJob(job());

  const restored = await evaluateMatchingPair(
    repository,
    { candidateUserId: "candidate-1", jobId: "job-1" },
    dependencies,
  );

  assert.equal(restored.status, "unchanged");
  assert.equal(rerankCalls, 1);
  assert.deepEqual(
    repository.snapshotRecommendations().map(({ status }) => status),
    ["NEW", "NEW"],
  );
});

test("evaluation completion is fenced against a newer input claim", async () => {
  const repository = createInMemoryMatchingRepository();
  const pair = { candidateUserId: "candidate-1", jobId: "job-1" };
  const first = await repository.claimEvaluation({
    ...pair,
    inputHash: "hash-1",
    scoringVersion: "matching-v1",
  });
  const second = await repository.claimEvaluation({
    ...pair,
    inputHash: "hash-2",
    scoringVersion: "matching-v1",
  });
  assert.equal(first.status, "claimed");
  assert.equal(second.status, "claimed");
  if (first.status !== "claimed" || second.status !== "claimed") {
    assert.fail("expected both changed inputs to be claimed");
  }

  const staleCompleted = await repository.publishEvaluation({
    ...first.claim,
    ruleScore: 80,
    matchScore: 80,
    confidence: 0.8,
    recommendedAction: "SAVE_ONLY",
    reasons: [],
    missingRequirements: [],
    riskFlags: [],
    recommendations: null,
  });
  const currentCompleted = await repository.publishEvaluation({
    ...second.claim,
    ruleScore: 90,
    matchScore: 90,
    confidence: 0.9,
    recommendedAction: "SUGGEST_APPLY",
    reasons: [],
    missingRequirements: [],
    riskFlags: [],
    recommendations: null,
  });

  assert.equal(staleCompleted.published, false);
  assert.equal(currentCompleted.published, true);
  assert.equal(repository.snapshotEvaluations()[0]?.matchScore, 90);
});

test("stale workers cannot overwrite recommendations from a newer claim", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate(candidate());
  repository.seedJob(job());
  let releaseFirst!: (value: {
    output: {
      matchScore: number;
      confidence: number;
      reasons: string[];
      missingRequirements: string[];
      riskFlags: string[];
      recommendedAction: "SAVE_ONLY";
    };
    llmInvoked: boolean;
  }) => void;
  let markFirstStarted!: () => void;
  const firstStarted = new Promise<void>((resolve) => {
    markFirstStarted = resolve;
  });
  const firstRerank = new Promise<Parameters<typeof releaseFirst>[0]>(
    (resolve) => {
      releaseFirst = resolve;
    },
  );

  const staleWorker = evaluateMatchingPair(
    repository,
    { candidateUserId: "candidate-1", jobId: "job-1" },
    {
      rerank: async () => {
        markFirstStarted();
        return firstRerank;
      },
    },
  );
  await firstStarted;
  repository.seedCandidate(candidate({ headline: "Staff Frontend Engineer" }));
  await evaluateMatchingPair(
    repository,
    { candidateUserId: "candidate-1", jobId: "job-1" },
    {
      rerank: async () => ({
        output: {
          matchScore: 90,
          confidence: 0.9,
          reasons: ["new input"],
          missingRequirements: [],
          riskFlags: [],
          recommendedAction: "SUGGEST_APPLY" as const,
        },
        llmInvoked: true,
      }),
    },
  );
  releaseFirst({
    output: {
      matchScore: 75,
      confidence: 0.7,
      reasons: ["stale input"],
      missingRequirements: [],
      riskFlags: [],
      recommendedAction: "SAVE_ONLY",
    },
    llmInvoked: true,
  });
  await staleWorker;

  assert.deepEqual(
    repository.snapshotRecommendations().map(({ matchScore }) => matchScore),
    [90, 90],
  );
});

test("evaluation failures are recorded and rethrown", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate(candidate());
  repository.seedJob(job());

  await assert.rejects(
    evaluateMatchingPair(
      repository,
      { candidateUserId: "candidate-1", jobId: "job-1" },
      {
        rerank: async () => {
          throw new Error("provider unavailable");
        },
      },
    ),
    /provider unavailable/,
  );

  const evaluation = repository.snapshotEvaluations()[0];
  assert.equal(evaluation?.status, "FAILED");
  assert.match(evaluation?.failureCode ?? "", /provider unavailable/);
});

test("publication failure rolls back recommendations before marking the claim failed", async () => {
  const repository = createInMemoryMatchingRepository({
    beforeRecommendationWrite(input) {
      if (input.type === "TALENT_TO_COMPANY") {
        throw new Error("publication failed");
      }
    },
  });
  repository.seedCandidate(candidate());
  repository.seedJob(job());

  await assert.rejects(
    evaluateMatchingPair(
      repository,
      { candidateUserId: "candidate-1", jobId: "job-1" },
      {
        rerank: async () => ({
          output: {
            matchScore: 90,
            confidence: 0.9,
            reasons: ["strong fit"],
            missingRequirements: [],
            riskFlags: [],
            recommendedAction: "SUGGEST_APPLY",
          },
          llmInvoked: true,
        }),
      },
    ),
    /publication failed/,
  );

  assert.deepEqual(repository.snapshotRecommendations(), []);
  assert.equal(repository.snapshotEvaluations()[0]?.status, "FAILED");
});

test("failure recording cannot overwrite a completed evaluation", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedEvaluation({
    candidateUserId: "candidate-1",
    jobId: "job-1",
    inputHash: "hash-1",
    scoringVersion: "matching-v1",
    status: "COMPLETED",
    attemptCount: 2,
  });

  const failed = await repository.failEvaluation({
    candidateUserId: "candidate-1",
    jobId: "job-1",
    inputHash: "hash-1",
    scoringVersion: "matching-v1",
    attemptCount: 2,
    failureCode: "late failure",
    retryable: true,
  });

  assert.equal(failed, false);
  assert.equal(repository.snapshotEvaluations()[0]?.status, "COMPLETED");
});

test("unchanged recommendation repair is fenced against a newer claim", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate(candidate());
  repository.seedJob(job());
  await evaluateMatchingPair(
    repository,
    { candidateUserId: "candidate-1", jobId: "job-1" },
    {
      rerank: async () => ({
        output: {
          matchScore: 90,
          confidence: 0.9,
          reasons: ["strong fit"],
          missingRequirements: [],
          riskFlags: [],
          recommendedAction: "SUGGEST_APPLY",
        },
        llmInvoked: false,
      }),
    },
  );
  const completed = repository.snapshotEvaluations()[0]!;

  const newer = await repository.claimEvaluation({
    candidateUserId: completed.candidateUserId,
    jobId: completed.jobId,
    inputHash: "newer-hash",
    scoringVersion: completed.scoringVersion,
  });
  assert.equal(newer.status, "claimed");

  const repaired = await repository.repairRecommendations({
    candidateUserId: completed.candidateUserId,
    jobId: completed.jobId,
    inputHash: completed.inputHash,
    scoringVersion: completed.scoringVersion,
    attemptCount: completed.attemptCount,
    recommendations: null,
  });

  assert.equal(repaired.published, false);
  assert.deepEqual(
    repository.snapshotRecommendations().map(({ status }) => status),
    ["NEW", "NEW"],
  );
});

test("RUNNING claims are busy until their bounded lease expires", async () => {
  const repository = createInMemoryMatchingRepository();
  const now = new Date("2026-06-30T00:10:00.000Z");
  const pair = { candidateUserId: "candidate-1", jobId: "job-1" };
  repository.seedEvaluation({
    ...pair,
    inputHash: "hash-1",
    scoringVersion: "matching-v1",
    status: "RUNNING",
    attemptCount: 4,
    updatedAt: new Date(now.getTime() - RUNNING_EVALUATION_LEASE_MS + 1),
  });

  const fresh = await repository.claimEvaluation(
    { ...pair, inputHash: "hash-1", scoringVersion: "matching-v1" },
    { now },
  );
  assert.equal(fresh.status, "busy");

  repository.seedEvaluation({
    ...pair,
    inputHash: "hash-1",
    scoringVersion: "matching-v1",
    status: "RUNNING",
    attemptCount: 4,
    updatedAt: new Date(now.getTime() - RUNNING_EVALUATION_LEASE_MS),
  });
  const atCutoff = await repository.claimEvaluation(
    { ...pair, inputHash: "hash-1", scoringVersion: "matching-v1" },
    { now },
  );
  assert.equal(atCutoff.status, "busy");

  repository.seedEvaluation({
    ...pair,
    inputHash: "hash-1",
    scoringVersion: "matching-v1",
    status: "RUNNING",
    attemptCount: 4,
    updatedAt: new Date(now.getTime() - RUNNING_EVALUATION_LEASE_MS - 1),
  });
  const expired = await repository.claimEvaluation(
    { ...pair, inputHash: "hash-1", scoringVersion: "matching-v1" },
    { now },
  );

  assert.equal(expired.status, "claimed");
  if (expired.status !== "claimed") {
    assert.fail("expected expired RUNNING evaluation to be reclaimed");
  }
  assert.equal(expired.claim.attemptCount, 5);
});

test("claim conflict classification never reports mismatched input as unchanged", () => {
  const request = {
    candidateUserId: "candidate-1",
    jobId: "job-1",
    inputHash: "requested-hash",
    scoringVersion: "matching-v1",
  };
  const persisted = {
    id: "evaluation-1",
    ...request,
    inputHash: "newer-hash",
    status: "COMPLETED" as const,
    ruleScore: 90,
    matchScore: 90,
    confidence: 0.9,
    recommendedAction: "SUGGEST_APPLY" as const,
    reasons: [],
    missingRequirements: [],
    riskFlags: [],
    failureCode: null,
    attemptCount: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  assert.equal(classifyEvaluationClaimConflict(request, persisted), "busy");
  assert.equal(
    classifyEvaluationClaimConflict(
      { ...request, inputHash: persisted.inputHash },
      persisted,
    ),
    "unchanged",
  );
});

test("invalid persisted recommendation actions throw while null remains valid", () => {
  assert.equal(parsePersistedRecommendedAction(null), null);
  assert.equal(
    parsePersistedRecommendedAction("SUGGEST_APPLY"),
    "SUGGEST_APPLY",
  );
  assert.throws(
    () => parsePersistedRecommendedAction("INVALID"),
    /invalid persisted recommendedAction/,
  );
});

test("candidate pipeline preloads candidate, jobs, and applications once", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate(candidate());
  repository.seedJob(job({ id: "job-1" }));
  repository.seedJob(job({ id: "job-2" }));
  const originalCandidate = repository.getCandidateProfile.bind(repository);
  const originalJob = repository.getActiveJob.bind(repository);
  const originalApplications = repository.listAppliedJobIds.bind(repository);
  let candidateReads = 0;
  let jobReads = 0;
  let applicationReads = 0;
  repository.getCandidateProfile = async (userId) => {
    candidateReads += 1;
    return originalCandidate(userId);
  };
  repository.getActiveJob = async (jobId) => {
    jobReads += 1;
    return originalJob(jobId);
  };
  repository.listAppliedJobIds = async (candidateUserId) => {
    applicationReads += 1;
    return originalApplications(candidateUserId);
  };

  await runJobMatchingForCandidate(repository, "candidate-1", fallbackAgents());

  assert.deepEqual(
    { candidateReads, jobReads, applicationReads },
    { candidateReads: 1, jobReads: 0, applicationReads: 1 },
  );
});

test("talent pipeline preloads its job and reads applications once per candidate", async () => {
  const repository = createInMemoryMatchingRepository();
  repository.seedCandidate(candidate({ userId: "candidate-1" }));
  repository.seedCandidate(candidate({ userId: "candidate-2" }));
  repository.seedJob(job());
  const originalCandidate = repository.getCandidateProfile.bind(repository);
  const originalJob = repository.getActiveJob.bind(repository);
  const originalApplications = repository.listAppliedJobIds.bind(repository);
  let candidateReads = 0;
  let jobReads = 0;
  let applicationReads = 0;
  repository.getCandidateProfile = async (userId) => {
    candidateReads += 1;
    return originalCandidate(userId);
  };
  repository.getActiveJob = async (jobId) => {
    jobReads += 1;
    return originalJob(jobId);
  };
  repository.listAppliedJobIds = async (candidateUserId) => {
    applicationReads += 1;
    return originalApplications(candidateUserId);
  };

  await runTalentMatchingForJob(repository, "job-1", fallbackAgents());

  assert.deepEqual(
    { candidateReads, jobReads, applicationReads },
    { candidateReads: 0, jobReads: 1, applicationReads: 2 },
  );
});

test("matching run reports explicit pair and recommendation accounting", async () => {
  const repository = createInMemoryMatchingRepository();
  const candidateInput = candidate();
  const unchangedJob = job({ id: "job-unchanged" });
  const busyJob = job({ id: "job-busy" });
  repository.seedCandidate(candidateInput);
  repository.seedJob(job({ id: "job-new" }));
  repository.seedJob(unchangedJob);
  repository.seedJob(busyJob);
  repository.seedJob(job({ id: "job-applied" }));
  repository.seedApplication(candidateInput.userId, "job-applied");
  repository.seedEvaluation({
    candidateUserId: candidateInput.userId,
    jobId: unchangedJob.id,
    inputHash: createMatchingFingerprint(candidateInput, unchangedJob, {
      hasApplied: false,
    }),
    status: "COMPLETED",
    attemptCount: 1,
  });
  repository.seedEvaluation({
    candidateUserId: candidateInput.userId,
    jobId: busyJob.id,
    inputHash: createMatchingFingerprint(candidateInput, busyJob, {
      hasApplied: false,
    }),
    status: "RUNNING",
    attemptCount: 1,
  });

  const result = await runJobMatchingForCandidate(
    repository,
    candidateInput.userId,
    fallbackAgents(),
  );

  assert.deepEqual(
    {
      attempted: result.attempted,
      claimed: result.claimed,
      completed: result.completed,
      unchanged: result.unchanged,
      busy: result.busy,
      ineligible: result.ineligible,
      savedPairs: result.savedPairs,
      recommendationRowsWritten: result.recommendationRowsWritten,
      evaluated: result.evaluated,
      saved: result.saved.length,
    },
    {
      attempted: 4,
      claimed: 2,
      completed: 2,
      unchanged: 1,
      busy: 1,
      ineligible: 1,
      savedPairs: 1,
      recommendationRowsWritten: 2,
      evaluated: 4,
      saved: 1,
    },
  );
});
