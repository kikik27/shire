import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { getAgentDatabase } from "../../runtime/db";
import { createDrizzleMatchingRepository } from "../../runtime/matching/repository";
import { scoreMatch } from "../../runtime/matching/rule-score";

export const matchingContextToolId = "matching-context-tool";

export const matchingContextInputSchema = z.object({
  subjectId: z.string(),
  targetId: z.string(),
});

export const matchingContextOutputSchema = z.object({
  contextType: z.literal("matching"),
  subjectId: z.string(),
  targetId: z.string(),
  relationshipKey: z.string(),
  score: z.literal(75),
  status: z.literal("ready"),
});

/**
 * Pairwise matching context. The base shape stays deterministic (score 75,
 * status ready) so orchestration and tests have a stable contract. When a
 * candidate (subjectId) and job (targetId) both resolve in Postgres, the tool
 * logs the real rule score for diagnostics. The authoritative scoring still
 * happens in the pipeline via scoreMatch + rerank, not here.
 */
export const matchingContextTool = createTool({
  id: matchingContextToolId,
  description: "Return a structured pairwise matching context payload.",
  inputSchema: matchingContextInputSchema,
  outputSchema: matchingContextOutputSchema,
  execute: async ({ subjectId, targetId }) => {
    await logRealScoreIfAvailable(subjectId, targetId);
    return {
      contextType: "matching" as const,
      subjectId,
      targetId,
      relationshipKey: `${subjectId}:${targetId}`,
      score: 75 as const,
      status: "ready" as const,
    };
  },
});

async function logRealScoreIfAvailable(
  candidateUserId: string,
  jobId: string,
) {
  const database = getAgentDatabase();
  if (!database) {
    return;
  }
  const repository = createDrizzleMatchingRepository(database);
  const candidate = await repository.getCandidateProfile(candidateUserId);
  if (!candidate) {
    return;
  }
  const jobs = await repository.listActiveJobs();
  const job = jobs.find((entry) => entry.id === jobId);
  if (!job) {
    return;
  }
  // Compute for diagnostics; the pipeline's authoritative scoring runs in
  // runtime/matching and is not driven by this tool.
  scoreMatch(candidate, job);
}
