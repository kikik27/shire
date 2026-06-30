import type { MatchingEvaluationStatus } from "@shire/shared";

/**
 * Domain types consumed by the matching pipeline. These are deliberately plain
 * (no Drizzle, no Mastra) so the rule-score and filter engines are pure
 * functions that can be unit-tested with fixtures. The matching repository maps
 * database rows into these shapes.
 */

export type CandidateMatchInput = {
  userId: string;
  /** Structured candidate profile fields. The jsonb blob is loosely typed at
   * the DB layer; the repository extracts the fields the scorer reads. */
  fullName?: string;
  headline?: string;
  summary?: string;
  skills: string[];
  preferredRoles: string[];
  expectedSalary?: { min?: number; max?: number; currency?: string };
  location?: string;
  workPreference?: string;
  portfolioUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  yearsExperience?: number;
  profileStatus: string;
};

export type JobMatchInput = {
  id: string;
  recruiterUserId: string;
  title: string;
  description: string;
  companyName: string;
  location: string;
  remote: boolean;
  salaryRange: string;
  jobType: string;
  experienceLevel: string;
  skillsRequired: string[];
  status: string;
  riskLevel: string;
  riskScore: number;
};

export type MatchingEvaluation = {
  id: string;
  candidateUserId: string;
  jobId: string;
  inputHash: string;
  scoringVersion: string;
  status: MatchingEvaluationStatus;
  ruleScore: number | null;
  matchScore: number | null;
  confidence: number | null;
  recommendedAction: string | null;
  reasons: string[];
  missingRequirements: string[];
  riskFlags: string[];
  failureCode: string | null;
  attemptCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type MatchingRepository = {
  /** Load a CONFIRMED candidate profile, or null when not found/not confirmed. */
  getCandidateProfile(userId: string): Promise<CandidateMatchInput | null>;
  /** List all CONFIRMED candidate profiles (for talent matching). */
  listConfirmedCandidates(): Promise<CandidateMatchInput[]>;
  /** Active jobs, optionally excluding those owned by a recruiter. */
  listActiveJobs(options?: { excludeRecruiterUserId?: string }): Promise<JobMatchInput[]>;
  /** Job ids a candidate has already applied to. */
  listAppliedJobIds(candidateUserId: string): Promise<Set<string>>;
  /** Existing recommendation for a candidate/job/type pair, if any. */
  getRecommendation(
    candidateUserId: string,
    jobId: string,
    type: "JOB_TO_CANDIDATE" | "TALENT_TO_COMPANY",
  ): Promise<{ id: string } | null>;
  /** Upsert a recommendation keyed on (candidate, job, type). Returns the id. */
  saveRecommendation(input: {
    type: "JOB_TO_CANDIDATE" | "TALENT_TO_COMPANY";
    candidateUserId: string;
    recruiterUserId?: string;
    jobId?: string;
    matchScore: number;
    confidence?: number;
    reasons: string[];
    missingRequirements: string[];
    riskFlags: string[];
    recommendedAction: string;
  }): Promise<string>;
  /** Record an agent run for observability. */
  recordAgentRun(input: {
    agentName: string;
    workflowName?: string;
    status: "SUCCESS" | "FAILED" | "PARTIAL";
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    errorMessage?: string;
    latencyMs?: number;
  }): Promise<void>;
};
