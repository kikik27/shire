import { runJobCli } from "../runtime/server/job-cli";

export async function runOnchainSyncJob() {
  return {
    job: "onchain-sync",
    status: "ready",
    chain: "Stellar",
  };
}

runJobCli(import.meta.url, runOnchainSyncJob);
