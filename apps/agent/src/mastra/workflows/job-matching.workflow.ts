// STUB — deterministic placeholder workflow, not the real matching pipeline.
//
// The real Job Matching flow (per .agent/context/agent/workflows.md and
// matching-pipeline.md) is: Filter (exclude self-company jobs, already-applied)
// → Rule Score (skill 40%, experience 20%, location 15%, salary 10%, portfolio
// 10%, risk 5%) → AI Rerank → save recommendation at score >= 70, notify at
// >= 85. That pipeline depends on a Prisma data layer (Phase 1-7 in tasks.md)
// that does not exist yet. The score below is derived from input length and is
// NOT a match signal — it exists only so the workflow can be registered and
// exercised by the CLI runner and tests while the data layer lands.
//
// When the real pipeline lands, replace normalizeJobMatching with the
// Filter → Rule Score → Rerank implementation.

import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

export const jobMatchingWorkflowId = "job-matching-workflow" as const;

export const jobMatchingInputSchema = z.object({
  candidateSummary: z.string(),
  jobDescription: z.string(),
});

export const jobMatchingOutputSchema = z.object({
  matchSummary: z.string(),
  score: z.number().int().min(0).max(100),
});

export function normalizeJobMatching(
  candidateSummary: string,
  jobDescription: string,
) {
  const score = Math.min(
    100,
    Math.max(
      0,
      Math.round((candidateSummary.length + jobDescription.length) / 10),
    ),
  );

  return {
    matchSummary: "Candidate and job have been normalized for matching review.",
    score,
  };
}

const jobMatchingStep = createStep({
  id: "job-matching-step",
  inputSchema: jobMatchingInputSchema,
  outputSchema: jobMatchingOutputSchema,
  execute: async ({ inputData }) =>
    normalizeJobMatching(inputData.candidateSummary, inputData.jobDescription),
});

export const jobMatchingWorkflow = createWorkflow({
  id: jobMatchingWorkflowId,
  inputSchema: jobMatchingInputSchema,
  outputSchema: jobMatchingOutputSchema,
})
  .then(jobMatchingStep)
  .commit();
