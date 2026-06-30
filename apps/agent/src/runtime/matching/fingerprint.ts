import { createHash } from "node:crypto";

import { MATCHING_SCORING_VERSION } from "@shire/shared";
import type { MatchingEvaluationStatus } from "@shire/shared";

import type {
  CandidateMatchInput,
  JobMatchInput,
} from "./types";

export const RUNNING_EVALUATION_LEASE_MS = 5 * 60 * 1000;
/** Initial attempt plus two scheduler-driven retries for one input fingerprint. */
export const MAX_MATCHING_EVALUATION_ATTEMPTS = 3;

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

function hashCanonicalInput(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
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
      description: normalizeText(job.description),
      companyName: normalizeText(job.companyName),
      location: normalizeText(job.location),
      remote: Boolean(job.remote),
      salaryRange: normalizeText(job.salaryRange),
      jobType: normalizeText(job.jobType),
      experienceLevel: normalizeText(job.experienceLevel),
      skillsRequired: normalizeList(job.skillsRequired),
      status: normalizeText(job.status),
      riskLevel: normalizeText(job.riskLevel),
      riskScore: job.riskScore,
    },
  };

  return hashCanonicalInput(canonicalInput);
}

type ReconciliationEvaluation = {
  inputHash: string;
  scoringVersion: string;
  status: MatchingEvaluationStatus;
  failureCode: string | null;
  attemptCount: number;
  updatedAt: Date;
};

export function matchingQueueGeneration(
  inputHash: string,
  evaluation: ReconciliationEvaluation | null,
): number {
  return !evaluation ||
    evaluation.inputHash !== inputHash ||
    evaluation.scoringVersion !== MATCHING_SCORING_VERSION
    ? 1
    : evaluation.attemptCount + 1;
}

export function shouldReconcileMatchingPair(
  inputHash: string,
  evaluation: ReconciliationEvaluation | null,
  now = new Date(),
): boolean {
  if (
    !evaluation ||
    evaluation.inputHash !== inputHash ||
    evaluation.scoringVersion !== MATCHING_SCORING_VERSION
  ) {
    return true;
  }
  if (evaluation.status === "PENDING") {
    return evaluation.attemptCount < MAX_MATCHING_EVALUATION_ATTEMPTS;
  }
  if (evaluation.status === "FAILED") {
    return (
      evaluation.attemptCount < MAX_MATCHING_EVALUATION_ATTEMPTS &&
      (evaluation.failureCode?.startsWith("RETRYABLE:") ?? false)
    );
  }
  if (evaluation.status === "RUNNING") {
    return (
      evaluation.attemptCount < MAX_MATCHING_EVALUATION_ATTEMPTS &&
      evaluation.updatedAt.getTime() <
      now.getTime() - RUNNING_EVALUATION_LEASE_MS
    );
  }
  return false;
}
