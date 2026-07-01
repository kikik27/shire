import type {
  JobResult,
  ProcessableJob,
} from "../runtime/jobs/job-contracts";
import type { JobQueue } from "../runtime/jobs/job-queue";
import type { DurableJobRuntime } from "../runtime/jobs/bullmq-job-queue";

export type ProcessJob = (
  job: ProcessableJob,
  context: {
    attempt: number;
    maxAttempts?: number;
    signal: AbortSignal;
  },
) => Promise<JobResult>;

export type RuntimeJobServicesDependencies = {
  jobQueue?: JobQueue;
  durableJobRuntime?: DurableJobRuntime;
  processJob?: ProcessJob;
};

export type RuntimeJobServices = {
  jobQueue: JobQueue | undefined;
  durableJobRuntime: DurableJobRuntime | undefined;
  start: () => Promise<void>;
  close: () => void;
};
