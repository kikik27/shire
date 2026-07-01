import type {
  JobName,
  JobPayloadMap,
  JobResultMap,
} from "./job-contracts";

export type JobExecutionContext = {
  jobId: string;
  attempt: number;
  maxAttempts?: number;
  signal: AbortSignal;
};

export interface JobProcessor<TName extends JobName> {
  name: TName;
  llmPolicy: "required" | "forbidden";
  process(
    payload: JobPayloadMap[TName],
    context: JobExecutionContext,
  ): Promise<JobResultMap[TName]>;
}
