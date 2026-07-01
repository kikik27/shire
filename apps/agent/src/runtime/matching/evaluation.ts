import {
  MATCHING_SAVE_THRESHOLD,
  recommendActionFromScore,
  type MatchingOutput,
} from "@shire/shared";

import { filterCandidateToJob } from "./filter";
import { MAX_MATCHING_EVALUATION_ATTEMPTS } from "./fingerprint";
import {
  computeRuleScore,
  fallbackOutput,
  rerankMatch,
  type RerankDependencies,
  type RerankResult,
} from "./rerank";
import type {
  MatchingEvaluation,
  MatchingPair,
  MatchingRecommendationPublication,
  MatchingRepository,
  RecommendationInput,
} from "./types";

type MatchingPairEvaluationAccounting = {
  claimed: boolean;
  recommendationRowsWritten: number;
};

export type MatchingPairEvaluationResult = MatchingPairEvaluationAccounting &
  (
    | {
        status: "completed";
        recommended: boolean;
        output: MatchingOutput;
        llmInvoked: boolean;
      }
    | {
        status: "unchanged";
        recommended: boolean;
        llmInvoked: false;
      }
    | { status: "busy"; recommended: false; llmInvoked: false }
    | { status: "ineligible"; recommended: false; llmInvoked: false }
  );

export type MatchingEvaluationDependencies = {
  failureRetryable?: boolean;
  queuedInputHash?: string;
  rerank?: typeof rerankMatch;
  rerankDependencies?: RerankDependencies;
};

export async function evaluateMatchingPair(
  repository: MatchingRepository,
  pair: MatchingPair,
  dependencies: MatchingEvaluationDependencies = {},
): Promise<MatchingPairEvaluationResult> {
  const prepared = await repository.prepareEvaluation(pair);
  if (prepared.status === "unavailable") {
    return {
      status: "ineligible",
      recommended: false,
      llmInvoked: false,
      claimed: false,
      recommendationRowsWritten: 0,
    };
  }

  const { candidate, job, appliedJobIds, claimResult } = prepared;
  if (claimResult.status === "busy") {
    return {
      status: "busy",
      recommended: false,
      llmInvoked: false,
      claimed: false,
      recommendationRowsWritten: 0,
    };
  }
  if (claimResult.status === "unchanged") {
    const persistedOutput = outputFromEvaluation(claimResult.evaluation);
    const recommended = Boolean(
      persistedOutput &&
        isRecommended(
          persistedOutput.matchScore,
          persistedOutput.recommendedAction,
        ),
    );
    const publication = await repository.repairRecommendations({
      candidateUserId: claimResult.evaluation.candidateUserId,
      jobId: claimResult.evaluation.jobId,
      inputHash: claimResult.evaluation.inputHash,
      scoringVersion: claimResult.evaluation.scoringVersion,
      attemptCount: claimResult.evaluation.attemptCount,
      recommendations:
        persistedOutput && recommended
          ? recommendationsFor(
              pair,
              job.recruiterUserId,
              persistedOutput,
            )
          : null,
    });
    if (!publication.published) {
      return {
        status: "busy",
        recommended: false,
        llmInvoked: false,
        claimed: false,
        recommendationRowsWritten: 0,
      };
    }
    return {
      status: "unchanged",
      recommended,
      llmInvoked: false,
      claimed: false,
      recommendationRowsWritten: publication.recommendationRowsWritten,
    };
  }

  const { claim } = claimResult;
  try {
    const filter = filterCandidateToJob(
      candidate.userId,
      job,
      appliedJobIds,
    );
    if (!filter.allowed) {
      const publication = await repository.publishEvaluation({
        ...claim,
        ruleScore: null,
        matchScore: null,
        confidence: null,
        recommendedAction: null,
        reasons: [],
        missingRequirements: [filter.reason],
        riskFlags: [],
        recommendations: null,
      });
      if (!publication.published) {
        return {
          status: "busy",
          recommended: false,
          llmInvoked: false,
          claimed: true,
          recommendationRowsWritten: 0,
        };
      }
      return {
        status: "ineligible",
        recommended: false,
        llmInvoked: false,
        claimed: true,
        recommendationRowsWritten: publication.recommendationRowsWritten,
      };
    }

    const ruleScore = computeRuleScore(candidate, job);
    const rerank: RerankResult =
      ruleScore.score < MATCHING_SAVE_THRESHOLD - 5
        ? {
            output: fallbackOutput(ruleScore, "job-rerank"),
            llmInvoked: false,
          }
        : await (dependencies.rerank ?? rerankMatch)(
            candidate,
            job,
            ruleScore,
            "job-rerank",
            dependencies.rerankDependencies,
          );
    const recommended = isRecommended(
      rerank.output.matchScore,
      rerank.output.recommendedAction,
    );

    const publication = await repository.publishEvaluation({
      ...claim,
      ruleScore: ruleScore.score,
      matchScore: rerank.output.matchScore,
      confidence: rerank.output.confidence,
      recommendedAction: rerank.output.recommendedAction,
      reasons: rerank.output.reasons,
      missingRequirements: rerank.output.missingRequirements,
      riskFlags: rerank.output.riskFlags,
      recommendations: recommended
        ? recommendationsFor(
            pair,
            job.recruiterUserId,
            rerank.output,
          )
        : null,
    });
    if (!publication.published) {
      return {
        status: "busy",
        recommended: false,
        llmInvoked: false,
        claimed: true,
        recommendationRowsWritten: 0,
      };
    }

    return {
      status: "completed",
      recommended,
      output: rerank.output,
      llmInvoked: rerank.llmInvoked,
      claimed: true,
      recommendationRowsWritten: publication.recommendationRowsWritten,
    };
  } catch (error) {
    const queueAttemptMatchesClaim =
      dependencies.queuedInputHash === undefined ||
      dependencies.queuedInputHash === claim.inputHash;
    await repository.failEvaluation({
      ...claim,
      failureCode: error instanceof Error ? error.message : "matching failed",
      retryable:
        (!queueAttemptMatchesClaim ||
          (dependencies.failureRetryable ?? true)) &&
        claim.attemptCount < MAX_MATCHING_EVALUATION_ATTEMPTS,
    });
    throw error;
  }
}

function outputFromEvaluation(
  evaluation: MatchingEvaluation,
): MatchingOutput | null {
  if (
    evaluation.matchScore === null ||
    evaluation.confidence === null ||
    evaluation.recommendedAction === null
  ) {
    return null;
  }
  return {
    matchScore: evaluation.matchScore,
    confidence: evaluation.confidence,
    recommendedAction: evaluation.recommendedAction,
    reasons: evaluation.reasons,
    missingRequirements: evaluation.missingRequirements,
    riskFlags: evaluation.riskFlags,
  };
}

function recommendationsFor(
  pair: MatchingPair,
  recruiterUserId: string,
  output: MatchingOutput,
): MatchingRecommendationPublication {
  const recommendation = (
    type: RecommendationInput["type"],
    direction: "candidate-to-job" | "job-to-candidate",
  ): RecommendationInput => ({
    ...pair,
    type,
    recruiterUserId,
    matchScore: output.matchScore,
    confidence: output.confidence,
    reasons: output.reasons,
    missingRequirements: output.missingRequirements,
    riskFlags: output.riskFlags,
    recommendedAction: recommendActionFromScore(output.matchScore, direction),
  });
  return [
    recommendation("JOB_TO_CANDIDATE", "candidate-to-job"),
    recommendation("TALENT_TO_COMPANY", "job-to-candidate"),
  ];
}

function isRecommended(
  matchScore: number | null,
  recommendedAction: string | null,
): boolean {
  return (
    matchScore !== null &&
    matchScore >= MATCHING_SAVE_THRESHOLD &&
    recommendedAction !== "IGNORE"
  );
}
