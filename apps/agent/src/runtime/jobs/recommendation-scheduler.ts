import type { JobRequest } from "./job-contracts";
import type {
  MatchingReconciliationCursor,
  MatchingRepository,
} from "../matching/types";
import { logger } from "../logger";

const schedulerLogger = logger.child({ component: "recommendation-scheduler" });

export type RecommendationSchedulerRepository = Pick<
  MatchingRepository,
  "reconcileMatchingPairs" | "expireUnavailableRecommendations"
>;

export type RecommendationSchedulerDependencies = {
  enabled: boolean;
  intervalMs: number;
  getRepository: () => RecommendationSchedulerRepository | undefined;
  enqueue: (request: JobRequest) => Promise<{ deduplicated?: boolean } | unknown>;
  setInterval?: typeof setInterval;
  clearInterval?: typeof clearInterval;
};

export class RecommendationScheduler {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private cursor: MatchingReconciliationCursor | undefined;

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
      return emptyResult("disabled");
    }

    if (this.running) {
      schedulerLogger.warn("recommendation scheduler run skipped because a previous run is still active");
      return emptyResult("busy");
    }

    const repository = this.dependencies.getRepository();
    if (!repository) {
      schedulerLogger.warn("recommendation scheduler skipped because database is unavailable");
      return emptyResult("no-database");
    }

    this.running = true;
    const startedAt = Date.now();
    try {
      const now = new Date();
      const expiredRecommendations =
        await repository.expireUnavailableRecommendations({
          limit: 500,
          updatedBefore: now,
        });
      const reconciliation = await repository.reconcileMatchingPairs({
        limit: 500,
        cursor: this.cursor,
        now,
      });
      this.cursor = reconciliation.nextCursor;
      let pairJobs = 0;
      let deduplicated = 0;
      for (const pair of reconciliation.pairs) {
        const request: JobRequest = {
          name: "matching-pair",
          payload: pair,
          deduplicationKey: [
            "matching-pair",
            pair.candidateId,
            pair.jobId,
            pair.inputHash,
          ].join(":"),
        };
        const enqueueResult = await this.dependencies.enqueue(request);
        if (
          enqueueResult &&
          typeof enqueueResult === "object" &&
          "deduplicated" in enqueueResult &&
          enqueueResult.deduplicated === true
        ) {
          deduplicated += 1;
        } else {
          pairJobs += 1;
        }
      }

      schedulerLogger.info(
        {
          pairJobs,
          skipped: reconciliation.skippedPairs,
          deduplicated,
          expiredRecommendations,
          scannedPairs: reconciliation.scannedPairs,
          durationMs: Date.now() - startedAt,
        },
        "recommendation scheduler enqueued matching jobs",
      );

      return {
        status: "queued" as const,
        pairJobs,
        skipped: reconciliation.skippedPairs,
        deduplicated,
        expiredRecommendations,
      };
    } catch (error) {
      schedulerLogger.error(
        {
          err: error,
          durationMs: Date.now() - startedAt,
        },
        "recommendation scheduler failed",
      );
      return emptyResult("failed");
    } finally {
      this.running = false;
    }
  }
}

function emptyResult(
  status: "disabled" | "busy" | "no-database" | "failed",
) {
  return {
    status,
    pairJobs: 0,
    skipped: 0,
    deduplicated: 0,
    expiredRecommendations: 0,
  };
}
