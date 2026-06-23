import { disputeSummaryAgent } from "../mastra/agents/dispute-summary.agent";
import { disputeSummaryWorkflow } from "../mastra/workflows/dispute-summary.workflow";
import { jobRunnerData } from "../runtime/data/runtime-data";
import { runJobCli } from "../runtime/server/job-cli";
import { createJobRouting } from "../runtime/server/job-routing";

export async function runDisputeSummaryJob() {
  return {
    job: "dispute-summary",
    agent: disputeSummaryAgent.id,
    workflow: disputeSummaryWorkflow.id,
    data: jobRunnerData["dispute-summary"],
    routing: createJobRouting("dispute-summary"),
    usage: [],
  };
}

runJobCli(import.meta.url, runDisputeSummaryJob);
