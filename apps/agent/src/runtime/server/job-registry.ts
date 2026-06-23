import { runCvParseJob } from "../../jobs/run-cv-parse";
import { runDisputeSummaryJob } from "../../jobs/run-dispute-summary";
import { runJobMatchingJob } from "../../jobs/run-job-matching";
import { runKnowledgeSyncJob } from "../../jobs/run-knowledge-sync";
import { runOnchainSyncJob } from "../../jobs/run-onchain-sync";
import { runTalentMatchingJob } from "../../jobs/run-talent-matching";

export const jobRegistry = {
  "cv-parse": runCvParseJob,
  "job-matching": runJobMatchingJob,
  "knowledge-sync": runKnowledgeSyncJob,
  "talent-matching": runTalentMatchingJob,
  "onchain-sync": runOnchainSyncJob,
  "dispute-summary": runDisputeSummaryJob,
} as const;

export type JobName = keyof typeof jobRegistry;

export function resolveJobName(value: string | undefined): JobName | null {
  if (value === undefined) {
    return null;
  }

  return Object.prototype.hasOwnProperty.call(jobRegistry, value)
    ? (value as JobName)
    : null;
}
