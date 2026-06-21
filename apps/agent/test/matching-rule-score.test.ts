import assert from "node:assert/strict";
import test from "node:test";

import {
  scoreMatch,
  ruleScoreReasons,
  RULE_WEIGHTS,
} from "../src/runtime/matching/rule-score";
import type { CandidateMatchInput, JobMatchInput } from "../src/runtime/matching/types";

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

function candidate(overrides: Partial<CandidateMatchInput> = {}): CandidateMatchInput {
  return {
    userId: "candidate-1",
    fullName: "Maya Okafor",
    headline: "Senior Frontend Engineer",
    summary: "Builds UI with TypeScript and React.",
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

test("weights sum to 1", () => {
  const total = Object.values(RULE_WEIGHTS).reduce((sum, w) => sum + w, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test("perfect skill overlap with strong profile scores high", () => {
  const result = scoreMatch(candidate(), job());
  assert.ok(result.score >= 80, `expected >= 80, got ${result.score}`);
  assert.equal(result.components.skill.raw, 1);
  assert.equal(result.components.experience.raw, 1);
});

test("zero skill overlap tanks the skill component but keeps others", () => {
  const result = scoreMatch(candidate({ skills: ["python", "go"] }), job());
  assert.equal(result.components.skill.raw, 0);
  assert.ok(result.components.skill.points < 1);
  // Other components still contribute.
  assert.ok(result.score > 0);
});

test("remote jobs give a high location component regardless of city", () => {
  const result = scoreMatch(candidate({ location: "Lagos" }), job({ remote: true, location: "Jakarta" }));
  assert.ok(result.components.location.raw >= 0.9);
});

test("non-remote job with matching location scores location highly", () => {
  const result = scoreMatch(
    candidate({ location: "Jakarta" }),
    job({ remote: false, location: "Jakarta" }),
  );
  assert.equal(result.components.location.raw, 1);
});

test("non-remote job with mismatched location scores location low", () => {
  const result = scoreMatch(
    candidate({ location: "Lagos" }),
    job({ remote: false, location: "Jakarta" }),
  );
  assert.ok(result.components.location.raw <= 0.2);
});

test("high job risk reduces the risk component and surfaces a reason", () => {
  const result = scoreMatch(candidate(), job({ riskLevel: "HIGH", riskScore: 80 }));
  assert.ok(result.components.risk.raw < 0.5);
  const reasons = ruleScoreReasons(result);
  assert.ok(reasons.some((r) => r.includes("risk level")));
});

test("experience gap below required level lowers the experience component", () => {
  const result = scoreMatch(
    candidate({ yearsExperience: 1, preferredRoles: [] }),
    job({ experienceLevel: "SENIOR" }),
  );
  assert.ok(result.components.experience.raw <= 0.25);
});

test("portfolio with three signals scores near the portfolio cap", () => {
  const result = scoreMatch(candidate(), job());
  assert.ok(result.components.portfolio.raw >= 0.9);
});

test("candidate with no portfolio signals scores low portfolio", () => {
  const result = scoreMatch(
    candidate({ portfolioUrl: undefined, githubUrl: undefined, linkedinUrl: undefined }),
    job(),
  );
  assert.ok(result.components.portfolio.raw <= 0.3);
});

test("score is clamped to 0-100", () => {
  const result = scoreMatch(candidate(), job());
  assert.ok(result.score >= 0 && result.score <= 100);
});
