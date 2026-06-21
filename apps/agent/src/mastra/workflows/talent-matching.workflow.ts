// STUB — deterministic placeholder workflow, not the real matching pipeline.
//
// The real Talent Matching flow (per .agent/context/agent/workflows.md and
// matching-pipeline.md) is: Filter (exclude company members as candidates,
// recently-invited candidates) → Rule Score → AI Rerank → save recommendation
// at score >= 70, notify company at >= 85. That pipeline depends on a Prisma
// data layer (Phase 1-7 in tasks.md) that does not exist yet. The score below
// is derived from input length and is NOT a match signal — it exists only so
// the workflow can be registered and exercised by the CLI runner and tests
// while the data layer lands.
//
// When the real pipeline lands, replace normalizeTalentMatching with the
// Filter → Rule Score → Rerank implementation.

import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

export const talentMatchingWorkflowId = "talent-matching-workflow" as const;

export const talentMatchingInputSchema = z.object({
  companyNeed: z.string(),
  talentProfile: z.string(),
});

export const talentMatchingOutputSchema = z.object({
  matchSummary: z.string(),
  score: z.number().int().min(0).max(100),
});

export function normalizeTalentMatching(
  companyNeed: string,
  talentProfile: string,
) {
  const score = Math.min(
    100,
    Math.max(
      0,
      Math.round((companyNeed.length + talentProfile.length) / 10),
    ),
  );

  return {
    matchSummary: "Talent and company need have been normalized for review.",
    score,
  };
}

const talentMatchingStep = createStep({
  id: "talent-matching-step",
  inputSchema: talentMatchingInputSchema,
  outputSchema: talentMatchingOutputSchema,
  execute: async ({ inputData }) =>
    normalizeTalentMatching(inputData.companyNeed, inputData.talentProfile),
});

export const talentMatchingWorkflow = createWorkflow({
  id: talentMatchingWorkflowId,
  inputSchema: talentMatchingInputSchema,
  outputSchema: talentMatchingOutputSchema,
})
  .then(talentMatchingStep)
  .commit();
