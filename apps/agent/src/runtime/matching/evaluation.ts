import {
  MATCHING_SAVE_THRESHOLD,
  MATCHING_SCORING_VERSION,
  recommendActionFromScore,
  type MatchingOutput,
} from "@shire/shared";

import { filterCandidateToJob } from "./filter";
import { createMatchingFingerprint } from "./fingerprint";
import {
  computeRuleScore,
  fallbackOutput,
  rerankMatch,
  type RerankDependencies,
  type RerankResult,
} from "./rerank";
import type {
  CandidateMatchInput,
  JobMatchInput,
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
  rerank?: typeof rerankMatch;
  rerankDependencies?: RerankDependencies;
  preloaded?: {
    candidate: CandidateMatchInput;
    job: JobMatchInput;
    appliedJobIds: ReadonlySet<string>;
  };
};

export async function evaluateMatchingPair(
  repository: MatchingRepository,
  pair: MatchingPair,
  dependencies: MatchingEvaluationDependencies = {},
): Promise<MatchingPairEvaluationResult> {
  const [candidate, job] = dependencies.preloaded
    ? [dependencies.preloaded.candidate, dependencies.preloaded.job]
    : await Promise.all([
        repository.getCandidateProfile(pair.candidateUserId),
        repository.getActiveJob(pair.jobId),
      ]);
  if (!candidate || !job) {
    return {
      status: "ineligible",
      recommended: false,
      llmInvoked: false,
      claimed: false,
      recommendationRowsWritten: 0,
    };
  }

  const appliedJobIds =
    dependencies.preloaded?.appliedJobIds ??
    (await repository.listAppliedJobIds(candidate.userId));
  const inputHash = createMatchingFingerprint(candidate, job, {
    hasApplied: appliedJobIds.has(job.id),
  });
  const claimResult = await repository.claimEvaluation({
    ...pair,
    inputHash,
    scoringVersion: MATCHING_SCORING_VERSION,
  });
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
    await repository.failEvaluation({
      ...claim,
      failureCode: error instanceof Error ? error.message : "matching failed",
      retryable: true,
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
