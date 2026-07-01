import { randomUUID } from "node:crypto";

import { jobMatchingAgent } from "../mastra/agents/job-matching.agent";
import { jobMatchingWorkflow } from "../mastra/workflows/job-matching.workflow";
import { jobMatchingProcessor } from "../runtime/jobs/matching.processor";
import { runJobCli } from "../runtime/server/job-cli";
import { createJobRouting } from "../runtime/server/job-routing";

type JobMatchingCliDependencies = {
  createJobId?: () => string;
  process?: typeof jobMatchingProcessor.process;
};

export async function runJobMatchingJob(
  args: readonly string[] = [],
  dependencies: JobMatchingCliDependencies = {},
) {
  const candidateId = args[0]?.trim();
  if (!candidateId) {
    throw new Error("Candidate ID is required.");
  }

  const result = await (dependencies.process ?? jobMatchingProcessor.process)(
    { candidateId },
    {
      jobId: dependencies.createJobId?.() ?? randomUUID(),
      attempt: 1,
      signal: new AbortController().signal,
    },
  );

  return {
    job: "job-matching",
    agent: jobMatchingAgent.id,
    workflow: jobMatchingWorkflow.id,
    routing: createJobRouting("job-matching"),
    ...result,
  };
}

runJobCli(import.meta.url, runJobMatchingJob);
