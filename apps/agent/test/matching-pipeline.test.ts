import assert from "node:assert/strict";
import test from "node:test";

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

test("rerank enables JSON prompt injection for direct model providers", async () => {
  const ruleScore = scoreMatch(candidate(), job());
  let structuredOutput: unknown;
  const fakeAgent = {
    async generate(_messages: unknown, options: { structuredOutput?: unknown }) {
      structuredOutput = options.structuredOutput;
      return { object: fallbackOutput(ruleScore, "talent-rerank") };
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
  assert.equal(
    (structuredOutput as { jsonPromptInjection?: boolean }).jsonPromptInjection,
    true,
  );
});
