import type {
  JobResultMap,
} from "./job-contracts";
import type { JobProcessor } from "./job-processor";
import { getAgentDatabase } from "../db";
import { createDrizzleMatchingRepository } from "../matching/repository";
import {
  runJobMatchingForCandidate,
  runTalentMatchingForJob,
} from "../matching/pipeline";

type JobMatchingResult = JobResultMap["job-matching"];
type TalentMatchingResult = JobResultMap["talent-matching"];

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
