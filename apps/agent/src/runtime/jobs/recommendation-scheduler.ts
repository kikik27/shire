import type { JobRequest } from "./job-contracts";
import type { MatchingRepository } from "../matching/types";
import { logger } from "../logger";

const schedulerLogger = logger.child({ component: "recommendation-scheduler" });

export type RecommendationSchedulerRepository = Pick<
  MatchingRepository,
  "listConfirmedCandidates" | "listActiveJobs"
>;

export type RecommendationSchedulerDependencies = {
  enabled: boolean;
  intervalMs: number;
  getRepository: () => RecommendationSchedulerRepository | undefined;
  enqueue: (request: JobRequest) => Promise<unknown>;
  setInterval?: typeof setInterval;
  clearInterval?: typeof clearInterval;
};

export class RecommendationScheduler {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(private readonly dependencies: RecommendationSchedulerDependencies) {}

  start() {
    if (!this.dependencies.enabled || this.timer) {
      return;
    }

    const interval = this.dependencies.setInterval ?? setInterval;
    this.timer = interval(() => {
      void this.runOnce();
    }, this.dependencies.intervalMs);
    this.timer.unref?.();

    schedulerLogger.info(
      { intervalMs: this.dependencies.intervalMs },
      "recommendation scheduler started",
    );
  }

  close() {
    if (!this.timer) {
      return;
    }

    const clear = this.dependencies.clearInterval ?? clearInterval;
    clear(this.timer);
    this.timer = undefined;
    schedulerLogger.info("recommendation scheduler stopped");
  }

  async runOnce() {
    if (!this.dependencies.enabled) {
      return { status: "disabled" as const, candidateJobs: 0, talentJobs: 0 };
    }

    if (this.running) {
      schedulerLogger.warn("recommendation scheduler run skipped because a previous run is still active");
      return { status: "busy" as const, candidateJobs: 0, talentJobs: 0 };
    }

    const repository = this.dependencies.getRepository();
    if (!repository) {
      schedulerLogger.warn("recommendation scheduler skipped because database is unavailable");
      return { status: "no-database" as const, candidateJobs: 0, talentJobs: 0 };
    }

    this.running = true;
    const startedAt = Date.now();
    try {
      const [candidates, jobs] = await Promise.all([
        repository.listConfirmedCandidates(),
        repository.listActiveJobs(),
      ]);

      for (const candidate of candidates) {
        await this.dependencies.enqueue({
          name: "job-matching",
          payload: { candidateId: candidate.userId },
        });
      }

      for (const job of jobs) {
        await this.dependencies.enqueue({
          name: "talent-matching",
          payload: { jobId: job.id },
        });
      }

      schedulerLogger.info(
        {
          candidateJobs: candidates.length,
          talentJobs: jobs.length,
          durationMs: Date.now() - startedAt,
        },
        "recommendation scheduler enqueued matching jobs",
      );

      return {
        status: "queued" as const,
        candidateJobs: candidates.length,
        talentJobs: jobs.length,
      };
    } catch (error) {
      schedulerLogger.error(
        {
          err: error,
          durationMs: Date.now() - startedAt,
        },
        "recommendation scheduler failed",
      );
      return { status: "failed" as const, candidateJobs: 0, talentJobs: 0 };
    } finally {
      this.running = false;
    }
  }
}

