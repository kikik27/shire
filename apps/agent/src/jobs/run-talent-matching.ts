import { talentMatchingAgent } from "../mastra/agents/talent-matching.agent";
import { talentMatchingWorkflow } from "../mastra/workflows/talent-matching.workflow";
import { jobRunnerData } from "../runtime/data/runtime-data";
import { runJobCli } from "../runtime/server/job-cli";
import { createJobRouting } from "../runtime/server/job-routing";

export async function runTalentMatchingJob() {
  return {
    job: "talent-matching",
    agent: talentMatchingAgent.id,
    workflow: talentMatchingWorkflow.id,
    data: jobRunnerData["talent-matching"],
    routing: createJobRouting("talent-matching"),
    usage: [],
  };
}

runJobCli(import.meta.url, runTalentMatchingJob);
