import { z } from "zod";

import type { CandidateProfileDraft } from "../cv/candidate-profile";
import type { ModelUsageRecord } from "../models/usage";

const deduplicationKeySchema = z.string().trim().min(1).max(256).optional();

const cvParseRequestSchema = z.object({
  name: z.literal("cv-parse"),
  payload: z.object({
    candidateId: z.string().trim().min(1),
    rawCv: z.string().trim().min(1).max(100_000),
  }).strict(),
  deduplicationKey: deduplicationKeySchema,
}).strict();

const onchainSyncRequestSchema = z.object({
  name: z.literal("onchain-sync"),
  payload: z.object({
    chain: z.literal("Stellar"),
  }).strict(),
  deduplicationKey: deduplicationKeySchema,
}).strict();

const jobMatchingRequestSchema = z.object({
  name: z.literal("job-matching"),
  payload: z.object({
    candidateId: z.string().trim().min(1),
  }).strict(),
  deduplicationKey: deduplicationKeySchema,
}).strict();

const talentMatchingRequestSchema = z.object({
  name: z.literal("talent-matching"),
  payload: z.object({
    jobId: z.string().trim().min(1),
  }).strict(),
  deduplicationKey: deduplicationKeySchema,
}).strict();

const matchingPairRequestSchema = z.object({
  name: z.literal("matching-pair"),
  payload: z.object({
    candidateId: z.string().trim().min(1),
    jobId: z.string().trim().min(1),
    inputHash: z.string().trim().min(1).max(128),
  }).strict(),
  deduplicationKey: deduplicationKeySchema,
}).strict();

export const jobRequestSchema = z.discriminatedUnion("name", [
  cvParseRequestSchema,
  onchainSyncRequestSchema,
  jobMatchingRequestSchema,
  talentMatchingRequestSchema,
  matchingPairRequestSchema,
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
  "matching-pair": Extract<JobRequest, { name: "matching-pair" }>["payload"];
};

export type MatchingJobResult = {
  status: "ready" | "no-database" | "skipped";
  saved: number;
  evaluated: number;
  strong: number;
  llmInvoked: boolean;
  durationMs: number;
};

export type MatchingPairJobResult = {
  status: "completed" | "unchanged" | "busy" | "ineligible" | "no-database";
  claimed: boolean;
  recommended: boolean;
  recommendationRowsWritten: number;
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
    chain: "Stellar";
    llmInvoked: false;
  };
  "job-matching": MatchingJobResult;
  "talent-matching": MatchingJobResult;
  "matching-pair": MatchingPairJobResult;
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
  deduplicated?: boolean;
  error?: {
    code: string;
    message: string;
  };
};

export type ProcessableJob = Pick<JobEnvelope, "id" | "name" | "payload">;

export function parseJobRequest(input: unknown): JobRequest {
  return jobRequestSchema.parse(input);
}
