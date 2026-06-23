import { runJobCli } from "../runtime/server/job-cli";
import { syncKnowledgeBase } from "../runtime/knowledge";

export async function runKnowledgeSyncJob() {
  const result = await syncKnowledgeBase();

  return {
    job: "knowledge-sync",
    ...result,
  } as const;
}

runJobCli(import.meta.url, runKnowledgeSyncJob);
