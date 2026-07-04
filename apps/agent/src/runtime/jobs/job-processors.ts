import type {
  JobResult,
  ProcessableJob,
} from "./job-contracts";
import type { JobExecutionContext } from "./job-processor";
import { cvParseProcessor } from "./cv-parse.processor";
import { onchainSyncProcessor } from "./onchain-sync.processor";
import {
  jobMatchingProcessor,
  matchingPairProcessor,
  talentMatchingProcessor,
} from "./matching.processor";

export type JobProcessorDependencies = {
  processCvParse?: typeof cvParseProcessor.process;
  processMatchingPair?: typeof matchingPairProcessor.process;
};

export function createJobProcessors(
  dependencies: JobProcessorDependencies = {},
) {
  return {
    async process(
      job: ProcessableJob,
      context: Omit<JobExecutionContext, "jobId">,
    ): Promise<JobResult> {
      const executionContext = { ...context, jobId: job.id };

      switch (job.name) {
        case "onchain-sync":
          return onchainSyncProcessor.process(
            job.payload as { chain: "Celo" },
            executionContext,
          );
        case "job-matching":
          return jobMatchingProcessor.process(
            job.payload as { candidateId: string },
            executionContext,
          );
        case "talent-matching":
          return talentMatchingProcessor.process(
            job.payload as { jobId: string },
            executionContext,
          );
        case "matching-pair":
          return (
            dependencies.processMatchingPair ?? matchingPairProcessor.process
          )(
            job.payload as {
              candidateId: string;
              jobId: string;
              inputHash: string;
            },
            executionContext,
          );
        case "cv-parse":
        default:
          return (dependencies.processCvParse ?? cvParseProcessor.process)(
            job.payload as { candidateId: string; rawCv: string },
            executionContext,
          );
      }
    },
  };
}
