import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import type {
  JobEnvelope,
  JobRequest,
  JobResult,
} from "./job-contracts";
import type { JobQueue } from "./job-queue";

export class InMemoryJobQueue implements JobQueue {
  private readonly records = new Map<string, JobEnvelope>();
  private readonly deterministicJobs = new Map<
    string,
    { jobId: string; request: JobRequest }
  >();
  private readonly waitingIds: string[] = [];
  private readonly waiters = new Set<() => void>();

  async enqueue(request: JobRequest) {
    if (request.deduplicationKey) {
      const existing = this.deterministicJobs.get(request.deduplicationKey);
      if (existing) {
        if (!isDeepStrictEqual(existing.request, request)) {
          throw new Error(
            `Deduplication key conflict: ${request.deduplicationKey}`,
          );
        }
        return {
          ...structuredClone(this.requireJob(existing.jobId)),
          deduplicated: true,
        };
      }
    }

    const job: JobEnvelope = {
      id: randomUUID(),
      name: request.name,
      payload: structuredClone(request.payload),
      status: "queued",
      attempts: 0,
      createdAt: new Date().toISOString(),
    };

    this.records.set(job.id, job);
    if (request.deduplicationKey) {
      this.deterministicJobs.set(request.deduplicationKey, {
        jobId: job.id,
        request: structuredClone(request),
      });
    }
    this.waitingIds.push(job.id);
    for (const wake of this.waiters) {
      wake();
    }
    this.waiters.clear();

    return structuredClone(job);
  }

  async reserve() {
    const id = this.waitingIds.shift();
    if (!id) {
      return undefined;
    }

    const job = this.records.get(id);
    return job ? structuredClone(job) : undefined;
  }

  async get(jobId: string) {
    const job = this.records.get(jobId);
    return job ? structuredClone(job) : undefined;
  }

  async markActive(jobId: string) {
    const job = this.requireJob(jobId);
    job.status = "active";
    job.attempts += 1;
    job.startedAt = new Date().toISOString();
    delete job.error;
  }

  async markCompleted(jobId: string, result: JobResult) {
    const job = this.requireJob(jobId);
    job.status = "completed";
    job.completedAt = new Date().toISOString();
    job.result = structuredClone(result);
    delete job.error;
  }

  async markFailed(
    jobId: string,
    error: { code: string; message: string },
  ) {
    const job = this.requireJob(jobId);
    job.status = "failed";
    job.completedAt = new Date().toISOString();
    job.error = { ...error };
  }

  async waitForJob(signal: AbortSignal) {
    if (this.waitingIds.length > 0 || signal.aborted) {
      return;
    }

    await new Promise<void>((resolve) => {
      const wake = () => {
        signal.removeEventListener("abort", wake);
        this.waiters.delete(wake);
        resolve();
      };

      this.waiters.add(wake);
      signal.addEventListener("abort", wake, { once: true });
    });
  }

  private requireJob(jobId: string) {
    const job = this.records.get(jobId);
    if (!job) {
      throw new Error(`Unknown job: ${jobId}`);
    }
    return job;
  }
}
