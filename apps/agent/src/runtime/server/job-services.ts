import { env } from "../../env";
import { getAgentDatabase } from "../db";
import {
  bullRetryCooldownMs,
  createBullMqJobRuntime,
  matchingJobAttempts,
} from "../jobs/bullmq-job-queue";
import { AgentWorker } from "../jobs/agent-worker";
import { createJobProcessors } from "../jobs/job-processors";
import { InMemoryJobQueue } from "../jobs/in-memory-job-queue";
import { RecommendationScheduler } from "../jobs/recommendation-scheduler";
import { createDrizzleMatchingRepository } from "../matching/repository";
import type {
  RuntimeJobServices,
  RuntimeJobServicesDependencies,
} from "../../types/jobs";

export function createRuntimeJobServices(
  dependencies: RuntimeJobServicesDependencies = {},
): RuntimeJobServices {
  const processors = createJobProcessors();
  const processJob = dependencies.processJob ?? processors.process;
  const durableJobRuntime =
    dependencies.durableJobRuntime ??
    (!dependencies.jobQueue && env.redisUrl
      ? createBullMqJobRuntime({
          redisUrl: env.redisUrl,
          queueName: env.jobQueueName,
          attempts: env.jobAttempts,
          backoffMs: env.jobBackoffMs,
          process: processJob,
        })
      : undefined);
  const jobQueue =
    dependencies.jobQueue ??
    (durableJobRuntime ? undefined : new InMemoryJobQueue());
  const worker = jobQueue
    ? new AgentWorker({ queue: jobQueue, process: processJob })
    : undefined;

  const schedulerCanEnqueueProcessableJobs =
    env.workerEnabled || durableJobRuntime !== undefined;
  const matchingScheduler = new RecommendationScheduler({
    enabled:
      env.recommendationSchedulerEnabled && schedulerCanEnqueueProcessableJobs,
    intervalMs: env.recommendationSchedulerIntervalMs,
    retryCooldownMs: durableJobRuntime
      ? bullRetryCooldownMs({
          attempts: matchingJobAttempts(env.jobAttempts),
          backoffMs: env.jobBackoffMs,
        })
      : 0,
    getRepository: () => {
      const database = getAgentDatabase();
      return database ? createDrizzleMatchingRepository(database) : undefined;
    },
    enqueue: (request) =>
      durableJobRuntime
        ? durableJobRuntime.enqueue(request)
        : jobQueue!.enqueue(request),
  });

  return {
    jobQueue,
    durableJobRuntime,
    async start() {
      if (env.workerEnabled) {
        if (durableJobRuntime) {
          await durableJobRuntime.start();
        } else {
          worker?.start();
        }
      }
      matchingScheduler.start();
    },
    close() {
      matchingScheduler.close();
      if (!env.workerEnabled) {
        return;
      }
      if (durableJobRuntime) {
        void durableJobRuntime.close();
      } else {
        void worker?.close();
      }
    },
  };
}
