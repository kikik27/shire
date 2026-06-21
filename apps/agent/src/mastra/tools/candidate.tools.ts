import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { getAgentDatabase } from "../../runtime/db";
import { createDrizzleMatchingRepository } from "../../runtime/matching/repository";

export const candidateContextToolId = "candidate-context-tool";

export const candidateContextInputSchema = z.object({
  candidateId: z.string(),
  scope: z.string().optional(),
});

export const candidateContextOutputSchema = z.object({
  contextType: z.literal("candidate"),
  candidateId: z.string(),
  scope: z.string(),
  status: z.literal("ready"),
  /** Real candidate data when resolvable from Postgres; omitted otherwise. */
  profile: z
    .object({
      fullName: z.string().optional(),
      headline: z.string().optional(),
      skills: z.array(z.string()),
      profileStatus: z.string(),
    })
    .optional(),
});

async function loadCandidate(candidateId: string) {
  const database = getAgentDatabase();
  if (!database) {
    return undefined;
  }
  const repository = createDrizzleMatchingRepository(database);
  const candidate = await repository.getCandidateProfile(candidateId);
  if (!candidate) {
    return undefined;
  }
  return {
    fullName: candidate.fullName,
    headline: candidate.headline,
    skills: candidate.skills,
    profileStatus: candidate.profileStatus,
  };
}

export const candidateContextTool = createTool({
  id: candidateContextToolId,
  description:
    "Return a structured candidate context payload for orchestration, enriched with profile data when available.",
  inputSchema: candidateContextInputSchema,
  outputSchema: candidateContextOutputSchema,
  execute: async ({ candidateId, scope }) => {
    const profile = await loadCandidate(candidateId);
    return {
      contextType: "candidate" as const,
      candidateId,
      scope: scope ?? "default",
      status: "ready" as const,
      ...(profile ? { profile } : {}),
    };
  },
});
