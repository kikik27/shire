import type {
  JobResultMap,
} from "./job-contracts";
import type {
  JobExecutionContext,
  JobProcessor,
} from "./job-processor";
import { getAgentDatabase } from "../db";
import { createDrizzleMatchingRepository } from "../matching/repository";
import { evaluateMatchingPair } from "../matching/evaluation";
import {
  runJobMatchingForCandidate,
  runTalentMatchingForJob,
} from "../matching/pipeline";

type JobMatchingResult = JobResultMap["job-matching"];
type TalentMatchingResult = JobResultMap["talent-matching"];
type MatchingPairResult = JobResultMap["matching-pair"];

export function matchingFailureRetryable(
  context: JobExecutionContext,
): boolean {
  return (
    context.maxAttempts === undefined ||
    context.attempt < context.maxAttempts
  );
}

function summarizeSaved(count: number, strong: number): {
  status: JobMatchingResult["status"];
  saved: number;
  strong: number;
} {
  if (count > 0) {
    return { status: "ready", saved: count, strong };
  }
  // No database, no candidates, or no jobs: distinguish "ran but saved
  // nothing" from "could not run at all" only at the caller; here we treat a
  // zero-save run as a successful "ready" run (skipped/ignored pairs).
  return { status: "ready", saved: 0, strong: 0 };
}

export const jobMatchingProcessor: JobProcessor<"job-matching"> = {
  name: "job-matching",
  llmPolicy: "required",
  async process(payload, context): Promise<JobMatchingResult> {
    const database = getAgentDatabase();
    if (!database) {
      return {
        status: "no-database",
        saved: 0,
        evaluated: 0,
        strong: 0,
        llmInvoked: false,
        durationMs: 0,
      };
    }

    void context;
    const repository = createDrizzleMatchingRepository(database);
    const result = await runJobMatchingForCandidate(repository, payload.candidateId);
    await repository.recordAgentRun({
      agentName: "job-matching-agent",
      workflowName: "job-matching",
      status: result.saved.length > 0 ? "SUCCESS" : "PARTIAL",
      input: { candidateId: payload.candidateId },
      output: {
        attempted: result.attempted,
        claimed: result.claimed,
        completed: result.completed,
        unchanged: result.unchanged,
        busy: result.busy,
        ineligible: result.ineligible,
        savedPairs: result.savedPairs,
        recommendationRowsWritten: result.recommendationRowsWritten,
        evaluated: result.evaluated,
        saved: result.saved.length,
        strong: result.saved.filter((outcome) => outcome.strong).length,
      },
      latencyMs: result.durationMs,
    });

    const summary = summarizeSaved(
      result.saved.length,
      result.saved.filter((outcome) => outcome.strong).length,
    );
    return {
      ...summary,
      evaluated: result.evaluated,
      llmInvoked: result.llmInvoked,
      durationMs: result.durationMs,
    };
  },
};

export const talentMatchingProcessor: JobProcessor<"talent-matching"> = {
  name: "talent-matching",
  llmPolicy: "required",
  async process(payload, context): Promise<TalentMatchingResult> {
    const database = getAgentDatabase();
    if (!database) {
      return {
        status: "no-database",
        saved: 0,
        evaluated: 0,
        strong: 0,
        llmInvoked: false,
        durationMs: 0,
      };
    }

    void context;
    const repository = createDrizzleMatchingRepository(database);
    const result = await runTalentMatchingForJob(repository, payload.jobId);
    await repository.recordAgentRun({
      agentName: "talent-matching-agent",
      workflowName: "talent-matching",
      status: result.saved.length > 0 ? "SUCCESS" : "PARTIAL",
      input: { jobId: payload.jobId },
      output: {
        attempted: result.attempted,
        claimed: result.claimed,
        completed: result.completed,
        unchanged: result.unchanged,
        busy: result.busy,
        ineligible: result.ineligible,
        savedPairs: result.savedPairs,
        recommendationRowsWritten: result.recommendationRowsWritten,
        evaluated: result.evaluated,
        saved: result.saved.length,
        strong: result.saved.filter((outcome) => outcome.strong).length,
      },
      latencyMs: result.durationMs,
    });

    const summary = summarizeSaved(
      result.saved.length,
      result.saved.filter((outcome) => outcome.strong).length,
    );
    return {
      ...summary,
      evaluated: result.evaluated,
      llmInvoked: result.llmInvoked,
      durationMs: result.durationMs,
    };
  },
};

export const matchingPairProcessor: JobProcessor<"matching-pair"> = {
  name: "matching-pair",
  llmPolicy: "required",
  async process(payload, context): Promise<MatchingPairResult> {
    const database = getAgentDatabase();
    if (!database) {
      return {
        status: "no-database",
        claimed: false,
        recommended: false,
        recommendationRowsWritten: 0,
        llmInvoked: false,
        durationMs: 0,
      };
    }

    const startedAt = Date.now();
    const repository = createDrizzleMatchingRepository(database);
    try {
      const result = await evaluateMatchingPair(
        repository,
        {
          candidateUserId: payload.candidateId,
          jobId: payload.jobId,
        },
        {
          failureRetryable: matchingFailureRetryable(context),
        },
      );
      const summary: MatchingPairResult = {
        status: result.status,
        claimed: result.claimed,
        recommended: result.recommended,
        recommendationRowsWritten: result.recommendationRowsWritten,
        llmInvoked: result.llmInvoked,
        durationMs: Date.now() - startedAt,
      };
      await repository.recordAgentRun({
        agentName: "matching-pair-agent",
        workflowName: "matching-pair",
        status: result.status === "busy" ? "PARTIAL" : "SUCCESS",
        input: {
          candidateId: payload.candidateId,
          jobId: payload.jobId,
          inputHash: payload.inputHash,
        },
        output: summary,
        latencyMs: summary.durationMs,
      });
      return summary;
    } catch (error) {
      await repository.recordAgentRun({
        agentName: "matching-pair-agent",
        workflowName: "matching-pair",
        status: "FAILED",
        input: {
          candidateId: payload.candidateId,
          jobId: payload.jobId,
          inputHash: payload.inputHash,
        },
        errorMessage:
          error instanceof Error ? error.message : "matching pair failed",
        latencyMs: Date.now() - startedAt,
      });
      throw error;
    }
  },
};
