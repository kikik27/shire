import type {
  MatchingEvaluationStatus,
  MatchingOutput,
  RecommendationStatus,
  RecommendationType,
} from "@shire/shared";

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
  recommendedAction: MatchingOutput["recommendedAction"] | null;
  reasons: string[];
  missingRequirements: string[];
  riskFlags: string[];
  failureCode: string | null;
  attemptCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type MatchingPair = {
  candidateUserId: string;
  jobId: string;
};

export function matchingPairKey(pair: MatchingPair): string {
  return `${pair.candidateUserId}:${pair.jobId}`;
}

export type MatchingEvaluationClaimInput = MatchingPair & {
  inputHash: string;
  scoringVersion: string;
};

export type MatchingEvaluationClaimOptions = {
  now?: Date;
};

export type MatchingEvaluationClaim = MatchingEvaluationClaimInput & {
  attemptCount: number;
};

export type MatchingEvaluationClaimResult =
  | { status: "claimed"; claim: MatchingEvaluationClaim }
  | { status: "unchanged"; evaluation: MatchingEvaluation }
  | { status: "busy"; evaluation: MatchingEvaluation };

export type PreparedMatchingEvaluation =
  | { status: "unavailable" }
  | {
      status: "ready";
      candidate: CandidateMatchInput;
      job: JobMatchInput;
      appliedJobIds: ReadonlySet<string>;
      claimResult: MatchingEvaluationClaimResult;
    };

export type MatchingEvaluationCompletion = MatchingEvaluationClaim & {
  ruleScore: number | null;
  matchScore: number | null;
  confidence: number | null;
  recommendedAction: MatchingOutput["recommendedAction"] | null;
  reasons: string[];
  missingRequirements: string[];
  riskFlags: string[];
};

export type MatchingEvaluationFailure = MatchingEvaluationClaim & {
  failureCode: string;
  retryable: boolean;
};

export type RecommendationInput = MatchingPair & {
  type: RecommendationType;
  recruiterUserId: string;
  matchScore: number;
  confidence: number;
  reasons: string[];
  missingRequirements: string[];
  riskFlags: string[];
  recommendedAction: MatchingOutput["recommendedAction"];
};

export type MatchingRecommendationPublication =
  | readonly [RecommendationInput, RecommendationInput]
  | null;

export type MatchingEvaluationPublication = MatchingEvaluationCompletion & {
  recommendations: MatchingRecommendationPublication;
};

export type MatchingRecommendationRepair = MatchingEvaluationClaim & {
  recommendations: MatchingRecommendationPublication;
};

export type MatchingPublicationResult = {
  published: boolean;
  recommendationRowsWritten: number;
};

export type MatchingRepository = {
  /** Load a CONFIRMED candidate profile, or null when not found/not confirmed. */
  getCandidateProfile(userId: string): Promise<CandidateMatchInput | null>;
  /** List all CONFIRMED candidate profiles (for talent matching). */
  listConfirmedCandidates(): Promise<CandidateMatchInput[]>;
  /** Active jobs, optionally excluding those owned by a recruiter. */
  listActiveJobs(options?: { excludeRecruiterUserId?: string }): Promise<JobMatchInput[]>;
  /** Load an ACTIVE job, or null when not found/not active. */
  getActiveJob(jobId: string): Promise<JobMatchInput | null>;
  /** Job ids a candidate has already applied to. */
  listAppliedJobIds(candidateUserId: string): Promise<Set<string>>;
  /** Reads current source data and claims its fingerprint as one atomic snapshot. */
  prepareEvaluation(
    pair: MatchingPair,
    options?: MatchingEvaluationClaimOptions,
  ): Promise<PreparedMatchingEvaluation>;
  getEvaluation(pair: MatchingPair): Promise<MatchingEvaluation | null>;
  claimEvaluation(
    input: MatchingEvaluationClaimInput,
    options?: MatchingEvaluationClaimOptions,
  ): Promise<MatchingEvaluationClaimResult>;
  /** Completes a RUNNING claim and publishes both audiences atomically. */
  publishEvaluation(
    input: MatchingEvaluationPublication,
  ): Promise<MatchingPublicationResult>;
  /** Repairs publication only while the exact COMPLETED evaluation still wins. */
  repairRecommendations(
    input: MatchingRecommendationRepair,
  ): Promise<MatchingPublicationResult>;
  /** Returns false when a newer claim fenced this failure out. */
  failEvaluation(input: MatchingEvaluationFailure): Promise<boolean>;
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

export type RecommendationSnapshot = {
  id: string;
  candidateUserId: string;
  jobId: string;
  matchScore: number;
  recommendedAction: string;
  status: RecommendationStatus;
  type: RecommendationType;
};
