import { createHash } from "node:crypto";

import { MATCHING_SCORING_VERSION } from "@shire/shared";

import type { CandidateMatchInput, JobMatchInput } from "./types";

function normalizeText(value: string | undefined): string | null {
  return value === undefined
    ? null
    : value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeList(values: string[]): string[] {
  return values
    .map((value) => normalizeText(value) ?? "")
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

export function createMatchingFingerprint(
  candidate: CandidateMatchInput,
  job: JobMatchInput,
  eligibility: { hasApplied: boolean },
): string {
  const canonicalInput = {
    scoringVersion: MATCHING_SCORING_VERSION,
    eligibility: {
      hasApplied: eligibility.hasApplied,
    },
    candidate: {
      userId: candidate.userId.trim(),
      fullName: normalizeText(candidate.fullName),
      headline: normalizeText(candidate.headline),
      skills: normalizeList(candidate.skills),
      preferredRoles: normalizeList(candidate.preferredRoles),
      expectedSalary: candidate.expectedSalary
        ? {
            min: candidate.expectedSalary.min ?? null,
            max: candidate.expectedSalary.max ?? null,
            currency: normalizeText(candidate.expectedSalary.currency),
          }
        : null,
      location: normalizeText(candidate.location),
      workPreference: normalizeText(candidate.workPreference),
      hasPortfolio: Boolean(candidate.portfolioUrl?.trim()),
      hasGithub: Boolean(candidate.githubUrl?.trim()),
      hasLinkedin: Boolean(candidate.linkedinUrl?.trim()),
      yearsExperience: candidate.yearsExperience ?? null,
      profileStatus: normalizeText(candidate.profileStatus),
    },
    job: {
      id: job.id.trim(),
      recruiterUserId: job.recruiterUserId.trim(),
      title: normalizeText(job.title),
      companyName: normalizeText(job.companyName),
      location: normalizeText(job.location),
      remote: Boolean(job.remote),
      salaryRange: normalizeText(job.salaryRange),
      experienceLevel: normalizeText(job.experienceLevel),
      skillsRequired: normalizeList(job.skillsRequired),
      status: normalizeText(job.status),
      riskLevel: normalizeText(job.riskLevel),
      riskScore: job.riskScore,
    },
  };

  return createHash("sha256")
    .update(JSON.stringify(canonicalInput))
    .digest("hex");
}
