import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import {
  Queue,
  UnrecoverableError,
  Worker,
  type ConnectionOptions,
  type JobsOptions,
} from "bullmq";

import type {
  JobEnvelope,
  JobRequest,
  JobResult,
  ProcessableJob,
} from "./job-contracts";
import { isRetryableJobError } from "./job-errors";
import { MAX_MATCHING_EVALUATION_ATTEMPTS } from "../matching/fingerprint";

export type BullJobLike = {
  id?: string;
  name: string;
  data: JobRequest;
  attemptsMade: number;
  delay?: number;
  opts: { attempts?: number; delay?: number };
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  returnvalue: JobResult | null;
  failedReason?: string;
  getState: () => Promise<string>;
  retry?: (
    state: "completed" | "failed",
    options: {
      resetAttemptsMade: boolean;
      resetAttemptsStarted: boolean;
    },
  ) => Promise<void>;
};

export type BullQueueLike = {
  getJob(jobId: string): Promise<BullJobLike | undefined>;
  add(
    name: string,
    data: JobRequest,
    options: JobsOptions,
  ): Promise<BullJobLike>;
};

export function bullRetryCooldownMs(input: {
  attempts: number;
  backoffMs: number;
}): number {
  if (input.attempts <= 1) {
    return 0;
  }
  return Math.min(
    Number.MAX_SAFE_INTEGER,
    input.backoffMs * 2 ** (input.attempts - 2),
  );
}

export function matchingJobAttempts(configuredAttempts: number): number {
  return Math.min(configuredAttempts, MAX_MATCHING_EVALUATION_ATTEMPTS);
}

export function bullJobExecutionContext(
  job: Pick<BullJobLike, "attemptsMade" | "opts">,
  signal: AbortSignal,
) {
  return {
    attempt: job.attemptsMade + 1,
    maxAttempts: job.opts.attempts,
    signal,
  };
}

export function createBullJobOptions(input: {
  attempts: number;
  backoffMs: number;
  jobId?: string;
  timestamp?: number;
}): JobsOptions {
  return {
    attempts: input.attempts,
    backoff: { type: "exponential", delay: input.backoffMs },
    removeOnComplete: false,
    removeOnFail: false,
    ...(input.jobId ? { jobId: input.jobId } : {}),
    ...(input.timestamp !== undefined
      ? { timestamp: input.timestamp }
      : {}),
  };
}

export function createBullDeduplicationJobId(
  deduplicationKey: string,
): string {
  const digest = createHash("sha256")
    .update(deduplicationKey)
    .digest("hex");
  return `dedup-${digest}`;
}

function mapStatus(state: string): JobEnvelope["status"] {
  if (state === "active") return "active";
  if (state === "completed") return "completed";
  if (state === "failed") return "failed";
  if (state === "delayed") return "delayed";
  return "queued";
}

export async function mapBullJobEnvelope(
  job: BullJobLike,
  candidateId?: string,
): Promise<JobEnvelope | undefined> {
  if (
    candidateId &&
    job.data.name === "cv-parse" &&
    job.data.payload.candidateId !== candidateId
  ) {
    return undefined;
  }

  const state = await job.getState();
  const status = mapStatus(state);
  const nextRetryAt =
    status === "delayed" && (job.delay ?? job.opts.delay)
      ? new Date(
          (job.processedOn ?? job.timestamp) +
            (job.delay ?? job.opts.delay ?? 0),
        ).toISOString()
      : undefined;

  return {
    id: job.id ?? "",
    name: job.data.name,
    payload: job.data.payload,
    status,
    attempts: job.attemptsMade,
    maxAttempts: job.opts.attempts,
    nextRetryAt,
    createdAt: new Date(job.timestamp).toISOString(),
    startedAt: job.processedOn
      ? new Date(job.processedOn).toISOString()
      : undefined,
    completedAt: job.finishedOn
      ? new Date(job.finishedOn).toISOString()
      : undefined,
    result: job.returnvalue ?? undefined,
    error:
      status === "failed"
        ? {
            code: "JOB_FAILED",
            message: job.failedReason ?? "Job failed",
          }
        : undefined,
  } as JobEnvelope;
}

export async function enqueueBullJob(
  queue: BullQueueLike,
  request: JobRequest,
  options: { attempts: number; backoffMs: number; now?: () => number },
): Promise<JobEnvelope> {
  const jobId = request.deduplicationKey
    ? createBullDeduplicationJobId(request.deduplicationKey)
    : undefined;
  if (jobId) {
    const existing = await queue.getJob(jobId);
    if (existing) {
      if (!isDeepStrictEqual(existing.data, request)) {
        throw new Error(
          `Deduplication key conflict: ${request.deduplicationKey}`,
        );
      }
      const state = await existing.getState();
      if (
        request.name === "matching-pair" &&
        (state === "completed" || state === "failed") &&
        existing.retry
      ) {
        try {
          await existing.retry(state, {
            resetAttemptsMade: true,
            resetAttemptsStarted: true,
          });
          return (await mapBullJobEnvelope(existing))!;
        } catch (error) {
          const winner = await queue.getJob(jobId);
          if (
            winner &&
            isDeepStrictEqual(winner.data, request) &&
            !["completed", "failed"].includes(await winner.getState())
          ) {
            return {
              ...(await mapBullJobEnvelope(winner))!,
              deduplicated: true,
            };
          }
          throw error;
        }
      } else {
        return {
          ...(await mapBullJobEnvelope(existing))!,
          deduplicated: true,
        };
      }
    }
  }

  const enqueueTimestamp = jobId
    ? (options.now?.() ?? Date.now())
    : undefined;
  const attempts =
    request.name === "matching-pair"
      ? matchingJobAttempts(options.attempts)
      : options.attempts;
  const job = await queue.add(
    request.name,
    request,
    createBullJobOptions({
      attempts,
      backoffMs: options.backoffMs,
      jobId,
      timestamp: enqueueTimestamp,
    }),
  );
  if (jobId) {
    const persisted = await queue.getJob(jobId);
    if (persisted && !isDeepStrictEqual(persisted.data, request)) {
      throw new Error(
        `Deduplication key conflict: ${request.deduplicationKey}`,
      );
    }
    if (
      persisted &&
      enqueueTimestamp !== undefined &&
      persisted.timestamp !== enqueueTimestamp
    ) {
      return {
        ...(await mapBullJobEnvelope(persisted))!,
        deduplicated: true,
      };
    }
  }
  return (await mapBullJobEnvelope(job))!;
}

export type DurableJobRuntime = {
  enqueue(request: JobRequest): Promise<JobEnvelope>;
  get(jobId: string, candidateId?: string): Promise<JobEnvelope | undefined>;
  start(): Promise<void>;
  close(): Promise<void>;
};

export function parseRedisConnection(redisUrl: string): ConnectionOptions {
  const parsed = new URL(redisUrl);
  const database = parsed.pathname.slice(1);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username
      ? decodeURIComponent(parsed.username)
      : undefined,
    password: parsed.password
      ? decodeURIComponent(parsed.password)
      : undefined,
    db: database ? Number(database) : undefined,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

export function createBullMqJobRuntime(input: {
  redisUrl: string;
  queueName: string;
  attempts: number;
  backoffMs: number;
  process: (
    job: ProcessableJob,
    context: {
      attempt: number;
      maxAttempts?: number;
      signal: AbortSignal;
    },
  ) => Promise<JobResult>;
}): DurableJobRuntime {
  const connection = parseRedisConnection(input.redisUrl);
  const queue = new Queue<JobRequest, JobResult, string>(input.queueName, {
    connection,
  });
  const abortController = new AbortController();
  const worker = new Worker<JobRequest, JobResult>(
    input.queueName,
    async (job) => {
      try {
        return await input.process(
          {
            id: job.id ?? "",
            name: job.data.name,
            payload: job.data.payload,
          } as ProcessableJob,
          bullJobExecutionContext(
            job as unknown as BullJobLike,
            abortController.signal,
          ),
        );
      } catch (error) {
        if (!isRetryableJobError(error)) {
          throw new UnrecoverableError(
            error instanceof Error ? error.message : "Permanent job failure",
          );
        }
        throw error;
      }
    },
    {
      connection,
      autorun: false,
    },
  );

  return {
    async enqueue(request) {
      return enqueueBullJob(
        queue as unknown as BullQueueLike,
        request,
        input,
      );
    },
    async get(jobId, candidateId) {
      const job = await queue.getJob(jobId);
      return job
        ? mapBullJobEnvelope(job as unknown as BullJobLike, candidateId)
        : undefined;
    },
    async start() {
      worker.run().catch(() => undefined);
      await worker.waitUntilReady();
    },
    async close() {
      abortController.abort();
      await worker.close();
      await queue.close();
    },
  };
}
