import { z } from "zod";

import type { CandidateProfileDraft } from "../cv/candidate-profile";
import type { ModelUsageRecord } from "../models/usage";

const cvParseRequestSchema = z.object({
  name: z.literal("cv-parse"),
  payload: z.object({
    candidateId: z.string().trim().min(1),
    rawCv: z.string().trim().min(1).max(100_000),
  }),
});

const onchainSyncRequestSchema = z.object({
  name: z.literal("onchain-sync"),
  payload: z.object({
    chain: z.literal("Celo"),
  }),
});

const jobMatchingRequestSchema = z.object({
  name: z.literal("job-matching"),
  payload: z.object({
    candidateId: z.string().trim().min(1),
  }),
});

const talentMatchingRequestSchema = z.object({
  name: z.literal("talent-matching"),
  payload: z.object({
    jobId: z.string().trim().min(1),
  }),
});

export const jobRequestSchema = z.discriminatedUnion("name", [
  cvParseRequestSchema,
  onchainSyncRequestSchema,
  jobMatchingRequestSchema,
  talentMatchingRequestSchema,
]);

export type JobRequest = z.infer<typeof jobRequestSchema>;
export type JobName = JobRequest["name"];
export type JobStatus =
  | "queued"
  | "delayed"
  | "active"
  | "completed"
  | "failed";

export type JobPayloadMap = {
  "cv-parse": Extract<JobRequest, { name: "cv-parse" }>["payload"];
  "onchain-sync": Extract<JobRequest, { name: "onchain-sync" }>["payload"];
  "job-matching": Extract<JobRequest, { name: "job-matching" }>["payload"];
  "talent-matching": Extract<JobRequest, { name: "talent-matching" }>["payload"];
};

export type MatchingJobResult = {
  status: "ready" | "no-database" | "skipped";
  saved: number;
  evaluated: number;
  strong: number;
  llmInvoked: boolean;
  durationMs: number;
};

export type JobResultMap = {
  "cv-parse": {
    candidateId: string;
    status: "PENDING_REVIEW";
    profile: CandidateProfileDraft;
    embeddingDimensions: number;
    usage: ModelUsageRecord[];
    llmInvoked: true;
  };
  "onchain-sync": {
    status: "ready";
    chain: "Celo";
    llmInvoked: false;
  };
  "job-matching": MatchingJobResult;
  "talent-matching": MatchingJobResult;
};

export type JobResult = JobResultMap[JobName];

export type JobEnvelope = {
  id: string;
  name: JobName;
  payload: JobPayloadMap[JobName];
  status: JobStatus;
  attempts: number;
  maxAttempts?: number;
  nextRetryAt?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: JobResult;
  error?: {
    code: string;
    message: string;
  };
};

export type ProcessableJob = Pick<JobEnvelope, "id" | "name" | "payload">;

export function parseJobRequest(input: unknown): JobRequest {
  return jobRequestSchema.parse(input);
}
