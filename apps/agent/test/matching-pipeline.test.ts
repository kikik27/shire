import assert from "node:assert/strict";
import test from "node:test";

import { MATCHING_EVALUATION_STATUSES } from "@shire/shared";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";

import {
  matchingEvaluationStatusEnum as agentMatchingEvaluationStatusEnum,
  matchingEvaluations as agentMatchingEvaluations,
} from "../src/runtime/db/schema";
import {
  createInMemoryMatchingRepository,
  mapCandidateProfileForMatching,
} from "../src/runtime/matching/repository";
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

  return {
    name: config.name,
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
        type: "PgNumeric",
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
  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0].type, "JOB_TO_CANDIDATE");
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
  assert.equal(snapshot[0].type, "TALENT_TO_COMPANY");
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
