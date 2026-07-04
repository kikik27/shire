import { randomUUID } from "node:crypto";

import { talentMatchingAgent } from "../mastra/agents/talent-matching.agent";
import { talentMatchingWorkflow } from "../mastra/workflows/talent-matching.workflow";
import { talentMatchingProcessor } from "../runtime/jobs/matching.processor";
import { runJobCli } from "../runtime/server/job-cli";
import { createJobRouting } from "../runtime/server/job-routing";

type TalentMatchingCliDependencies = {
  createJobId?: () => string;
  process?: typeof talentMatchingProcessor.process;
};

export async function runTalentMatchingJob(
  args: readonly string[] = [],
  dependencies: TalentMatchingCliDependencies = {},
) {
  const jobId = args[0]?.trim();
  if (!jobId) {
    throw new Error("Job ID is required.");
  }

  const result = await (dependencies.process ?? talentMatchingProcessor.process)(
    { jobId },
    {
      jobId: dependencies.createJobId?.() ?? randomUUID(),
      attempt: 1,
      signal: new AbortController().signal,
    },
  );

  return {
    job: "talent-matching",
    agent: talentMatchingAgent.id,
    workflow: talentMatchingWorkflow.id,
    routing: createJobRouting("talent-matching"),
    ...result,
  };
}

runJobCli(import.meta.url, runTalentMatchingJob);
