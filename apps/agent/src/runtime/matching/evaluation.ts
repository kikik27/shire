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
  MatchingEvaluation,
  MatchingEvaluationClaim,
  MatchingPair,
  MatchingRepository,
} from "./types";

export type MatchingPairEvaluationResult =
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
  | { status: "ineligible"; recommended: false; llmInvoked: false };

export type MatchingEvaluationDependencies = {
  rerank?: typeof rerankMatch;
  rerankDependencies?: RerankDependencies;
};

export async function evaluateMatchingPair(
  repository: MatchingRepository,
  pair: MatchingPair,
  dependencies: MatchingEvaluationDependencies = {},
): Promise<MatchingPairEvaluationResult> {
  const [candidate, job] = await Promise.all([
    repository.getCandidateProfile(pair.candidateUserId),
    repository.getActiveJob(pair.jobId),
  ]);
  if (!candidate || !job) {
    await repository.deactivateRecommendations(pair);
    return {
      status: "ineligible",
      recommended: false,
      llmInvoked: false,
    };
  }

  const inputHash = createMatchingFingerprint(candidate, job);
  const claimResult = await repository.claimEvaluation({
    ...pair,
    inputHash,
    scoringVersion: MATCHING_SCORING_VERSION,
  });
  if (claimResult.status === "busy") {
    return { status: "busy", recommended: false, llmInvoked: false };
  }
  if (claimResult.status === "unchanged") {
    const persistedOutput = outputFromEvaluation(claimResult.evaluation);
    if (persistedOutput && isRecommended(
      persistedOutput.matchScore,
      persistedOutput.recommendedAction,
    )) {
      await saveRecommendations(repository, pair, job.recruiterUserId, persistedOutput);
    } else {
      await repository.deactivateRecommendations(pair);
    }
    return {
      status: "unchanged",
      recommended: isRecommended(
        claimResult.evaluation.matchScore,
        claimResult.evaluation.recommendedAction,
      ),
      llmInvoked: false,
    };
  }

  const { claim } = claimResult;
  try {
    const filter = await filterCandidateToJob(
      repository,
      candidate.userId,
      job,
    );
    if (!filter.allowed) {
      const completed = await persistIneligible(
        repository,
        claim,
        pair,
        filter.reason,
      );
      if (!completed) {
        return { status: "busy", recommended: false, llmInvoked: false };
      }
      return {
        status: "ineligible",
        recommended: false,
        llmInvoked: false,
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

    const completed = await repository.completeEvaluation({
      ...claim,
      ruleScore: ruleScore.score,
      matchScore: rerank.output.matchScore,
      confidence: rerank.output.confidence,
      recommendedAction: rerank.output.recommendedAction,
      reasons: rerank.output.reasons,
      missingRequirements: rerank.output.missingRequirements,
      riskFlags: rerank.output.riskFlags,
    });
    if (!completed) {
      return { status: "busy", recommended: false, llmInvoked: false };
    }

    if (recommended) {
      await saveRecommendations(
        repository,
        pair,
        job.recruiterUserId,
        rerank.output,
      );
    } else {
      await repository.deactivateRecommendations(pair);
    }

    return {
      status: "completed",
      recommended,
      output: rerank.output,
      llmInvoked: rerank.llmInvoked,
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

async function saveRecommendations(
  repository: MatchingRepository,
  pair: MatchingPair,
  recruiterUserId: string,
  output: MatchingOutput,
) {
  await Promise.all(
    (["JOB_TO_CANDIDATE", "TALENT_TO_COMPANY"] as const).map((type) =>
      repository.saveRecommendation({
        ...pair,
        type,
        recruiterUserId,
        matchScore: output.matchScore,
        confidence: output.confidence,
        reasons: output.reasons,
        missingRequirements: output.missingRequirements,
        riskFlags: output.riskFlags,
        recommendedAction:
          type === "JOB_TO_CANDIDATE"
            ? recommendActionFromScore(
                output.matchScore,
                "candidate-to-job",
              )
            : recommendActionFromScore(
                output.matchScore,
                "job-to-candidate",
              ),
      }),
    ),
  );
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

async function persistIneligible(
  repository: MatchingRepository,
  claim: MatchingEvaluationClaim,
  pair: MatchingPair,
  reason: string,
) {
  const completed = await repository.completeEvaluation({
    ...claim,
    ruleScore: null,
    matchScore: null,
    confidence: null,
    recommendedAction: null,
    reasons: [],
    missingRequirements: [reason],
    riskFlags: [],
  });
  if (completed) {
    await repository.deactivateRecommendations(pair);
  }
  return completed;
}
