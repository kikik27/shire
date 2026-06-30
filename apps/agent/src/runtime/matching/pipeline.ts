import {
  MATCHING_STRONG_THRESHOLD,
  type MatchingOutput,
} from "@shire/shared";
import { logger } from "../logger";
import {
  evaluateMatchingPair,
  type MatchingPairEvaluationResult,
} from "./evaluation";
import type { RerankDependencies } from "./rerank";
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
  attempted: number;
  claimed: number;
  completed: number;
  unchanged: number;
  busy: number;
  ineligible: number;
  savedPairs: number;
  recommendationRowsWritten: number;
  /** Backward-compatible alias for attempted pairs. */
  evaluated: number;
  /** Backward-compatible completed recommendation outcomes. */
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
    return emptyRun("candidate-to-job", startedAt);
  }

  const jobs = await repository.listActiveJobs({
    excludeRecruiterUserId: candidateUserId,
  });
  const appliedJobIds = await repository.listAppliedJobIds(candidateUserId);
  const results: PairResult[] = [];
  for (const job of jobs) {
    results.push({
      candidateUserId,
      jobId: job.id,
      result: await evaluateMatchingPair(
        repository,
        { candidateUserId, jobId: job.id },
        {
          rerankDependencies,
          preloaded: { candidate, job, appliedJobIds },
        },
      ),
    });
  }

  return finishRun("candidate-to-job", results, startedAt);
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
  const job = await repository.getActiveJob(jobId);
  if (!job) {
    pipelineLogger.info({ jobId }, "talent matching skipped: job not active");
    return emptyRun("job-to-candidate", startedAt);
  }

  const candidates = await repository.listConfirmedCandidates();
  const results: PairResult[] = [];
  for (const candidate of candidates) {
    const appliedJobIds = await repository.listAppliedJobIds(candidate.userId);
    results.push({
      candidateUserId: candidate.userId,
      jobId,
      result: await evaluateMatchingPair(
        repository,
        { candidateUserId: candidate.userId, jobId },
        {
          rerankDependencies,
          preloaded: { candidate, job, appliedJobIds },
        },
      ),
    });
  }

  return finishRun("job-to-candidate", results, startedAt);
}

type PairResult = {
  candidateUserId: string;
  jobId: string;
  result: MatchingPairEvaluationResult;
};

function finishRun(
  direction: MatchingDirection,
  results: PairResult[],
  startedAt: number,
): MatchingRunResult {
  const saved = results.flatMap(({ candidateUserId, jobId, result }) => {
    if (result.status !== "completed" || !result.recommended) {
      return [];
    }
    const strong = result.output.matchScore >= MATCHING_STRONG_THRESHOLD;
    if (strong) {
      pipelineLogger.info(
        { candidateUserId, jobId, matchScore: result.output.matchScore },
        "strong recommendation: eligible for notification",
      );
    }
    return [
      {
        candidateUserId,
        jobId,
        matchScore: result.output.matchScore,
        recommendedAction: result.output.recommendedAction,
        saved: true,
        strong,
      },
    ];
  });

  return {
    direction,
    attempted: results.length,
    claimed: results.filter(({ result }) => result.claimed).length,
    completed: results.filter(
      ({ result }) =>
        result.status === "completed" ||
        (result.status === "ineligible" && result.claimed),
    ).length,
    unchanged: results.filter(({ result }) => result.status === "unchanged")
      .length,
    busy: results.filter(({ result }) => result.status === "busy").length,
    ineligible: results.filter(({ result }) => result.status === "ineligible")
      .length,
    savedPairs: results.filter(
      ({ result }) =>
        result.recommended && result.recommendationRowsWritten > 0,
    ).length,
    recommendationRowsWritten: results.reduce(
      (total, { result }) => total + result.recommendationRowsWritten,
      0,
    ),
    evaluated: results.length,
    saved,
    skippedBelowThreshold: results.filter(
      ({ result }) =>
        result.status === "completed" && result.recommended === false,
    ).length,
    llmInvoked: results.some(({ result }) => result.llmInvoked),
    durationMs: Date.now() - startedAt,
  };
}

function emptyRun(
  direction: MatchingDirection,
  startedAt: number,
): MatchingRunResult {
  return {
    direction,
    attempted: 0,
    claimed: 0,
    completed: 0,
    unchanged: 0,
    busy: 0,
    ineligible: 0,
    savedPairs: 0,
    recommendationRowsWritten: 0,
    evaluated: 0,
    saved: [],
    skippedBelowThreshold: 0,
    llmInvoked: false,
    durationMs: Date.now() - startedAt,
  };
}
