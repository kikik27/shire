import assert from "node:assert/strict";
import test from "node:test";

import { createMatchingFingerprint } from "../src/runtime/matching/fingerprint";
import type {
  CandidateMatchInput,
  JobMatchInput,
} from "../src/runtime/matching/types";

function candidate(
  overrides: Partial<CandidateMatchInput> = {},
): CandidateMatchInput {
  return {
    userId: "candidate-1",
    fullName: "Maya Okafor",
    headline: "Senior Frontend Engineer",
    summary: "Builds accessible product interfaces.",
    skills: ["TypeScript", "React"],
    preferredRoles: ["Frontend Engineer", "UI Engineer"],
    expectedSalary: { min: 120_000, max: 160_000, currency: "USD" },
    location: "Jakarta",
    workPreference: "Remote",
    portfolioUrl: "https://maya.example",
    githubUrl: "https://github.com/maya",
    linkedinUrl: "https://linkedin.com/in/maya",
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
    salaryRange: "$120k-$160k",
    jobType: "FULL_TIME",
    experienceLevel: "SENIOR",
    skillsRequired: ["React", "TypeScript"],
    status: "ACTIVE",
    riskLevel: "LOW",
    riskScore: 10,
    ...overrides,
  };
}

function fingerprint(
  candidateInput = candidate(),
  jobInput = job(),
  hasApplied = false,
) {
  return createMatchingFingerprint(candidateInput, jobInput, { hasApplied });
}

test("matching fingerprint is stable for equivalent case, whitespace, and array ordering", () => {
  const baseline = fingerprint();
  const equivalent = fingerprint(
    candidate({
      fullName: "  maya okafor ",
      headline: " senior frontend engineer ",
      skills: [" react ", "typescript"],
      preferredRoles: ["ui engineer", " FRONTEND ENGINEER "],
      expectedSalary: { min: 120_000, max: 160_000, currency: " usd " },
      location: " jakarta ",
      workPreference: " remote ",
      profileStatus: " confirmed ",
    }),
    job({
      title: " senior frontend engineer ",
      description: " build product ui. ",
      companyName: " acme ",
      location: " jakarta ",
      salaryRange: " $120K-$160K ",
      jobType: " full_time ",
      experienceLevel: " senior ",
      skillsRequired: ["typescript", " REACT "],
      status: " active ",
      riskLevel: " low ",
    }),
  );

  assert.match(baseline, /^[a-f0-9]{64}$/);
  assert.equal(equivalent, baseline);
});

test("matching fingerprint changes for scoring and filter inputs but not timestamps", () => {
  const baseline = fingerprint();
  const variants: Array<[CandidateMatchInput, JobMatchInput]> = [
    [candidate({ skills: ["TypeScript"] }), job()],
    [candidate({ expectedSalary: { min: 180_000, currency: "USD" } }), job()],
    [candidate({ profileStatus: "PENDING_REVIEW" }), job()],
    [candidate(), job({ recruiterUserId: "candidate-1" })],
    [candidate(), job({ remote: false })],
    [candidate(), job({ riskScore: 80 })],
  ];

  for (const [candidateInput, jobInput] of variants) {
    assert.notEqual(
      fingerprint(candidateInput, jobInput),
      baseline,
    );
  }

  const candidateWithTimestamp = {
    ...candidate(),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const jobWithTimestamp = {
    ...job(),
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
  };
  assert.equal(
    fingerprint(candidateWithTimestamp, jobWithTimestamp),
    baseline,
  );
  assert.equal(
    fingerprint(
      candidate({ summary: "Metadata not consumed by matching." }),
      job(),
    ),
    baseline,
  );
  assert.equal(
    fingerprint(candidate(), job({ description: "Different description." })),
    baseline,
  );
  assert.equal(
    fingerprint(candidate(), job({ jobType: "CONTRACT" })),
    baseline,
  );
});

test("matching fingerprint changes when the candidate applies", () => {
  assert.notEqual(
    fingerprint(candidate(), job(), false),
    fingerprint(candidate(), job(), true),
  );
});
