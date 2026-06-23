import { runJobCli } from "../runtime/server/job-cli";

export async function runOnchainSyncJob() {
  return {
    job: "onchain-sync",
    status: "ready",
    chain: "Celo",
  };
}

runJobCli(import.meta.url, runOnchainSyncJob);
