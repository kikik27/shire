import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { getAgentDatabase } from "../../runtime/db";
import { createDrizzleMatchingRepository } from "../../runtime/matching/repository";

export const jobContextToolId = "job-context-tool";

export const jobContextInputSchema = z.object({
  jobId: z.string(),
  scope: z.string().optional(),
});

export const jobContextOutputSchema = z.object({
  contextType: z.literal("job"),
  jobId: z.string(),
  scope: z.string(),
  status: z.literal("ready"),
  /** Real job data when resolvable from Postgres; omitted otherwise. */
  job: z
    .object({
      title: z.string(),
      companyName: z.string(),
      skillsRequired: z.array(z.string()),
      status: z.string(),
    })
    .optional(),
});

async function loadJob(jobId: string) {
  const database = getAgentDatabase();
  if (!database) {
    return undefined;
  }
  const repository = createDrizzleMatchingRepository(database);
  const jobs = await repository.listActiveJobs();
  const job = jobs.find((entry) => entry.id === jobId);
  if (!job) {
    return undefined;
  }
  return {
    title: job.title,
    companyName: job.companyName,
    skillsRequired: job.skillsRequired,
    status: job.status,
  };
}

export const jobContextTool = createTool({
  id: jobContextToolId,
  description:
    "Return a structured job context payload for orchestration, enriched with job data when available.",
  inputSchema: jobContextInputSchema,
  outputSchema: jobContextOutputSchema,
  execute: async ({ jobId, scope }) => {
    const job = await loadJob(jobId);
    return {
      contextType: "job" as const,
      jobId,
      scope: scope ?? "default",
      status: "ready" as const,
      ...(job ? { job } : {}),
    };
  },
});
