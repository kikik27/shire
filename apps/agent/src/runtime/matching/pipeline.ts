import {
  MATCHING_SAVE_THRESHOLD,
  MATCHING_STRONG_THRESHOLD,
  type MatchingOutput,
} from "@shire/shared";
import { logger } from "../logger";
import { filterCandidateToJob, filterTalentToJob } from "./filter";
import {
  computeRuleScore,
  rerankMatch,
  type RerankDependencies,
} from "./rerank";
import type { MatchingRepository } from "./types";

const pipelineLogger = logger.child({ component: "matching-pipeline" });

export type MatchingDirection = "candidate-to-job" | "job-to-candidate";

export type MatchingOutcome = {
  candidateUserId: string;
  jobId?: string;
  matchScore: number;
  recommendedAction: MatchingOutput["recommendedAction"];
  saved: boolean;
  strong: boolean;
};

export type MatchingRunResult = {
  direction: MatchingDirection;
  evaluated: number;
  saved: MatchingOutcome[];
  skippedBelowThreshold: number;
  llmInvoked: boolean;
  durationMs: number;
};

/**
 * Job matching: for a single CONFIRMED candidate, evaluate all ACTIVE jobs the
 * candidate could apply to. Filter → rule score → (only passing pairs) rerank
 * → persist recommendations for scores >= SAVE_THRESHOLD.
 */
export async function runJobMatchingForCandidate(
  repository: MatchingRepository,
  candidateUserId: string,
  rerankDependencies: RerankDependencies = {},
): Promise<MatchingRunResult> {
  const startedAt = Date.now();
  const candidate = await repository.getCandidateProfile(candidateUserId);
  if (!candidate) {
    pipelineLogger.info(
      { candidateUserId },
      "job matching skipped: candidate profile not confirmed",
    );
    return {
      direction: "candidate-to-job",
      evaluated: 0,
      saved: [],
      skippedBelowThreshold: 0,
      llmInvoked: false,
      durationMs: Date.now() - startedAt,
    };
  }

  const jobs = await repository.listActiveJobs({
    excludeRecruiterUserId: candidateUserId,
  });

  const outcomes: MatchingOutcome[] = [];
  let skippedBelowThreshold = 0;
  let llmInvoked = false;

  for (const job of jobs) {
    const filter = await filterCandidateToJob(repository, candidateUserId, job);
    if (!filter.allowed) {
      continue;
    }

    const ruleScore = computeRuleScore(candidate, job);

    // Retrieval-first: skip the LLM entirely when the rule score is already
    // well below the save threshold. Only the reduced, promising set reranks.
    if (ruleScore.score < MATCHING_SAVE_THRESHOLD - 5) {
      skippedBelowThreshold += 1;
      continue;
    }

    const rerank = await rerankMatch(
      candidate,
      job,
      ruleScore,
      "job-rerank",
      rerankDependencies,
    );
    llmInvoked = llmInvoked || rerank.llmInvoked;

    const outcome = await persistIfEligible(
      repository,
      rerank.output,
      candidateUserId,
      job.recruiterUserId,
      job.id,
      "candidate-to-job",
    );
    if (outcome) {
      outcomes.push(outcome);
    } else {
      skippedBelowThreshold += 1;
    }
  }

  return finishRun(
    "candidate-to-job",
    jobs.length,
    outcomes,
    skippedBelowThreshold,
    llmInvoked,
    startedAt,
  );
}

/**
 * Talent matching: for a single ACTIVE job, evaluate all CONFIRMED candidates.
 * Mirror of runJobMatchingForCandidate.
 */
export async function runTalentMatchingForJob(
  repository: MatchingRepository,
  jobId: string,
  rerankDependencies: RerankDependencies = {},
): Promise<MatchingRunResult> {
  const startedAt = Date.now();
  const jobs = await repository.listActiveJobs();
  const job = jobs.find((entry) => entry.id === jobId);
  if (!job) {
    pipelineLogger.info({ jobId }, "talent matching skipped: job not active");
    return {
      direction: "job-to-candidate",
      evaluated: 0,
      saved: [],
      skippedBelowThreshold: 0,
      llmInvoked: false,
      durationMs: Date.now() - startedAt,
    };
  }

  const candidates = await repository.listConfirmedCandidates();
  const outcomes: MatchingOutcome[] = [];
  let skippedBelowThreshold = 0;
  let llmInvoked = false;

  for (const candidate of candidates) {
    const filter = await filterTalentToJob(candidate, job);
    if (!filter.allowed) {
      continue;
    }

    const ruleScore = computeRuleScore(candidate, job);
    if (ruleScore.score < MATCHING_SAVE_THRESHOLD - 5) {
      skippedBelowThreshold += 1;
      continue;
    }

    const rerank = await rerankMatch(
      candidate,
      job,
      ruleScore,
      "talent-rerank",
      rerankDependencies,
    );
    llmInvoked = llmInvoked || rerank.llmInvoked;

    const outcome = await persistIfEligible(
      repository,
      rerank.output,
      candidate.userId,
      job.recruiterUserId,
      job.id,
      "job-to-candidate",
    );
    if (outcome) {
      outcomes.push(outcome);
    } else {
      skippedBelowThreshold += 1;
    }
  }

  return finishRun(
    "job-to-candidate",
    candidates.length,
    outcomes,
    skippedBelowThreshold,
    llmInvoked,
    startedAt,
  );
}

async function persistIfEligible(
  repository: MatchingRepository,
  output: MatchingOutput,
  candidateUserId: string,
  recruiterUserId: string,
  jobId: string,
  direction: MatchingDirection,
): Promise<MatchingOutcome | null> {
  if (
    output.recommendedAction === "IGNORE" ||
    output.matchScore < MATCHING_SAVE_THRESHOLD
  ) {
    return null;
  }

  const type = direction === "candidate-to-job" ? "JOB_TO_CANDIDATE" : "TALENT_TO_COMPANY";
  await repository.saveRecommendation({
    type,
    candidateUserId,
    recruiterUserId,
    jobId,
    matchScore: output.matchScore,
    confidence: output.confidence,
    reasons: output.reasons,
    missingRequirements: output.missingRequirements,
    riskFlags: output.riskFlags,
    recommendedAction: output.recommendedAction,
  });

  const strong = output.matchScore >= MATCHING_STRONG_THRESHOLD;
  if (strong) {
    pipelineLogger.info(
      { candidateUserId, jobId, matchScore: output.matchScore, type },
      "strong recommendation: eligible for notification",
    );
  }

  return {
    candidateUserId,
    jobId,
    matchScore: output.matchScore,
    recommendedAction: output.recommendedAction,
    saved: true,
    strong,
  };
}

function finishRun(
  direction: MatchingDirection,
  evaluated: number,
  saved: MatchingOutcome[],
  skippedBelowThreshold: number,
  llmInvoked: boolean,
  startedAt: number,
): MatchingRunResult {
  return {
    direction,
    evaluated,
    saved,
    skippedBelowThreshold,
    llmInvoked,
    durationMs: Date.now() - startedAt,
  };
}
