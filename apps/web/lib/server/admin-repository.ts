import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { DisputeStatus, PlatformStakeStatus } from "@shire/shared";

import type {
  JobStatus,
  PlatformDispute,
  PlatformStake,
} from "../types";
import type { AuditRepository } from "./audit-repository";
import {
  createInMemoryAuditRepository,
} from "./audit-repository";
import { createDatabase, type Database } from "./db";
import {
  auditLogs,
  disputes,
  jobs,
  stakes,
} from "./db/schema";
import type { DisputesRepository } from "./disputes-repository";
import {
  createInMemoryDisputesRepository,
  mapDispute,
} from "./disputes-repository";
import type { JobsRepository, PersistedJob } from "./jobs-repository";
import {
  createInMemoryJobsRepository,
  mapJob,
} from "./jobs-repository";
import type { StakesRepository } from "./stakes-repository";
import {
  createInMemoryStakesRepository,
  mapStake,
  StakeNotFoundError,
  StakeTransitionError,
} from "./stakes-repository";

export type AdminOverview = {
  totalJobs: number;
  activeStakes: number;
  openDisputes: number;
  flaggedJobs: number;
  jobStatuses: Record<string, number>;
  stakeStatuses: Record<string, number>;
  disputeStatuses: Record<string, number>;
};

export interface AdminRepository {
  getOverview(): Promise<AdminOverview>;
  listJobs(): Promise<PersistedJob[]>;
  moderateJob(
    id: string,
    action: "approve" | "flag" | "close",
    actorUserId: string,
  ): Promise<PersistedJob>;
  listStakes(): Promise<PlatformStake[]>;
  transitionStake(
    id: string,
    status: Exclude<PlatformStakeStatus, "LOCKED">,
    actorUserId: string,
    reason?: string,
  ): Promise<PlatformStake>;
  listDisputes(): Promise<PlatformDispute[]>;
  resolveDispute(
    id: string,
    input: {
      status: Extract<DisputeStatus, "RESOLVED" | "REJECTED">;
      decision: string;
      stakeStatus?: Extract<PlatformStakeStatus, "REFUNDED" | "SLASHED">;
    },
    actorUserId: string,
  ): Promise<PlatformDispute>;
}

export class AdminEntityNotFoundError extends Error {
  readonly code = "not-found";
}

export class AdminConflictError extends Error {
  readonly code = "invalid-transition";
}

function countsByStatus(
  rows: Array<{ status: string; count: number }>,
): Record<string, number> {
  return rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.status] = (counts[row.status] ?? 0) + row.count;
    return counts;
  }, {});
}

export function createDrizzleAdminRepository(
  database: Database = createDatabase(),
): AdminRepository {
  return {
    async getOverview() {
      const [
        [jobCount],
        [activeStakeCount],
        [openDisputeCount],
        [flaggedJobCount],
        jobStatusRows,
        stakeStatusRows,
        disputeStatusRows,
      ] = await Promise.all([
        database.select({ value: count() }).from(jobs),
        database
          .select({ value: count() })
          .from(stakes)
          .where(eq(stakes.status, "LOCKED")),
        database
          .select({ value: count() })
          .from(disputes)
          .where(inArray(disputes.status, ["OPEN", "UNDER_REVIEW"])),
        database
          .select({ value: count() })
          .from(jobs)
          .where(
            sql`${jobs.status} = 'FLAGGED' or ${jobs.riskLevel} = 'HIGH'`,
          ),
        database
          .select({ status: jobs.status, count: count() })
          .from(jobs)
          .groupBy(jobs.status),
        database
          .select({ status: stakes.status, count: count() })
          .from(stakes)
          .groupBy(stakes.status),
        database
          .select({ status: disputes.status, count: count() })
          .from(disputes)
          .groupBy(disputes.status),
      ]);
      return {
        totalJobs: jobCount?.value ?? 0,
        activeStakes: activeStakeCount?.value ?? 0,
        openDisputes: openDisputeCount?.value ?? 0,
        flaggedJobs: flaggedJobCount?.value ?? 0,
        jobStatuses: countsByStatus(jobStatusRows),
        stakeStatuses: countsByStatus(stakeStatusRows),
        disputeStatuses: countsByStatus(disputeStatusRows),
      };
    },
    async listJobs() {
      return (
        await database
          .select()
          .from(jobs)
          .orderBy(desc(jobs.createdAt))
          .limit(200)
      ).map(mapJob);
    },
    async moderateJob(id, action, actorUserId) {
      return database.transaction(async (transaction) => {
        const statusByAction = {
          approve: "ACTIVE",
          flag: "FLAGGED",
          close: "CLOSED",
        } satisfies Record<string, JobStatus>;
        const [row] = await transaction
          .update(jobs)
          .set({ status: statusByAction[action], updatedAt: new Date() })
          .where(eq(jobs.id, id))
          .returning();
        if (!row) throw new AdminEntityNotFoundError("Job was not found.");
        await transaction.insert(auditLogs).values({
          actorUserId,
          action: `job.${action}`,
          entityType: "job",
          entityId: id,
          metadata: { status: row.status },
        });
        return mapJob(row);
      });
    },
    async listStakes() {
      return (
        await database
          .select()
          .from(stakes)
          .orderBy(desc(stakes.createdAt))
          .limit(200)
      ).map(mapStake);
    },
    async transitionStake(id, status, actorUserId, reason) {
      return database.transaction(async (transaction) => {
        const [row] = await transaction
          .update(stakes)
          .set({ status, reason, updatedAt: new Date() })
          .where(and(eq(stakes.id, id), eq(stakes.status, "LOCKED")))
          .returning();
        if (!row) {
          const [existing] = await transaction
            .select({ id: stakes.id })
            .from(stakes)
            .where(eq(stakes.id, id))
            .limit(1);
          if (!existing) {
            throw new AdminEntityNotFoundError("Stake was not found.");
          }
          throw new AdminConflictError("Stake is already settled.");
        }
        await transaction.insert(auditLogs).values({
          actorUserId,
          action: `stake.${status.toLowerCase()}`,
          entityType: "stake",
          entityId: id,
          metadata: { reason },
        });
        if (row.type === "JOB_POST" && row.jobId) {
          await transaction
            .update(jobs)
            .set({ stakeAmount: "0", updatedAt: new Date() })
            .where(eq(jobs.id, row.jobId));
        }
        return mapStake(row);
      });
    },
    async listDisputes() {
      return (
        await database
          .select()
          .from(disputes)
          .orderBy(desc(disputes.createdAt))
          .limit(200)
      ).map(mapDispute);
    },
    async resolveDispute(id, input, actorUserId) {
      return database.transaction(async (transaction) => {
        const [current] = await transaction
          .select()
          .from(disputes)
          .where(eq(disputes.id, id))
          .limit(1);
        if (!current) {
          throw new AdminEntityNotFoundError("Dispute was not found.");
        }
        if (current.status === "RESOLVED" || current.status === "REJECTED") {
          throw new AdminConflictError("Dispute is already resolved.");
        }
        if (input.stakeStatus && current.stakeId) {
          const [stake] = await transaction
            .update(stakes)
            .set({
              status: input.stakeStatus,
              reason: input.decision,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(stakes.id, current.stakeId),
                eq(stakes.status, "LOCKED"),
              ),
            )
            .returning({
              id: stakes.id,
              type: stakes.type,
              jobId: stakes.jobId,
            });
          if (!stake) {
            throw new AdminConflictError(
              "The related stake cannot be settled.",
            );
          }
          await transaction.insert(auditLogs).values({
            actorUserId,
            action: `stake.${input.stakeStatus.toLowerCase()}`,
            entityType: "stake",
            entityId: current.stakeId,
            metadata: { disputeId: id },
          });
          if (stake.type === "JOB_POST" && stake.jobId) {
            await transaction
              .update(jobs)
              .set({ stakeAmount: "0", updatedAt: new Date() })
              .where(eq(jobs.id, stake.jobId));
          }
        }
        const [resolved] = await transaction
          .update(disputes)
          .set({
            status: input.status,
            adminDecision: input.decision,
            updatedAt: new Date(),
          })
          .where(eq(disputes.id, id))
          .returning();
        await transaction.insert(auditLogs).values({
          actorUserId,
          action: `dispute.${input.status.toLowerCase()}`,
          entityType: "dispute",
          entityId: id,
          metadata: {
            decision: input.decision,
            stakeStatus: input.stakeStatus,
          },
        });
        return mapDispute(resolved!);
      });
    },
  };
}

export function createInMemoryAdminRepository(
  dependencies: {
    jobs?: JobsRepository;
    stakes?: StakesRepository;
    disputes?: DisputesRepository;
    audit?: AuditRepository;
  } = {},
): AdminRepository {
  const jobsRepository = dependencies.jobs ?? createInMemoryJobsRepository();
  const stakesRepository =
    dependencies.stakes ?? createInMemoryStakesRepository();
  const disputesRepository =
    dependencies.disputes ?? createInMemoryDisputesRepository();
  const audit = dependencies.audit ?? createInMemoryAuditRepository();

  return {
    async getOverview() {
      const [allStakes, allDisputes] = await Promise.all([
        stakesRepository.listStakes(),
        disputesRepository.listDisputes(),
      ]);
      return {
        totalJobs: 0,
        activeStakes: allStakes.filter((stake) => stake.status === "LOCKED")
          .length,
        openDisputes: allDisputes.filter(
          (dispute) =>
            dispute.status === "OPEN" ||
            dispute.status === "UNDER_REVIEW",
        ).length,
        flaggedJobs: 0,
        jobStatuses: {},
        stakeStatuses: countsByStatus(
          allStakes.map((stake) => ({ status: stake.status, count: 1 })),
        ),
        disputeStatuses: countsByStatus(
          allDisputes.map((dispute) => ({
            status: dispute.status,
            count: 1,
          })),
        ),
      };
    },
    async listJobs() {
      return [];
    },
    async moderateJob(id, action, actorUserId) {
      const job = await jobsRepository.getJob(id);
      if (!job) throw new AdminEntityNotFoundError("Job was not found.");
      const statusByAction = {
        approve: "ACTIVE",
        flag: "FLAGGED",
        close: "CLOSED",
      } satisfies Record<string, JobStatus>;
      const updated = await jobsRepository.updateJobStatus(
        id,
        statusByAction[action],
      );
      await audit.appendAuditLog({
        actorUserId,
        action: `job.${action}`,
        entityType: "job",
        entityId: id,
        metadata: { status: updated.status },
      });
      return updated;
    },
    listStakes: () => stakesRepository.listStakes(),
    async transitionStake(id, status, actorUserId, reason) {
      try {
        const stake = await stakesRepository.transitionStake(
          id,
          status,
          actorUserId,
          reason,
        );
        await audit.appendAuditLog({
          actorUserId,
          action: `stake.${status.toLowerCase()}`,
          entityType: "stake",
          entityId: id,
          metadata: { reason },
        });
        return stake;
      } catch (error) {
        if (error instanceof StakeNotFoundError) {
          throw new AdminEntityNotFoundError(error.message);
        }
        if (error instanceof StakeTransitionError) {
          throw new AdminConflictError(error.message);
        }
        throw error;
      }
    },
    listDisputes: () => disputesRepository.listDisputes(),
    async resolveDispute(id, input, actorUserId) {
      const current = await disputesRepository.getDispute(id);
      if (!current) {
        throw new AdminEntityNotFoundError("Dispute was not found.");
      }
      if (input.stakeStatus && current.stakeId) {
        try {
          await stakesRepository.transitionStake(
            current.stakeId,
            input.stakeStatus,
            actorUserId,
            input.decision,
          );
        } catch (error) {
          if (error instanceof StakeNotFoundError) {
            throw new AdminEntityNotFoundError(error.message);
          }
          if (error instanceof StakeTransitionError) {
            throw new AdminConflictError(error.message);
          }
          throw error;
        }
        await audit.appendAuditLog({
          actorUserId,
          action: `stake.${input.stakeStatus.toLowerCase()}`,
          entityType: "stake",
          entityId: current.stakeId,
          metadata: { disputeId: id },
        });
      }
      const dispute = await disputesRepository.resolveDispute(
        id,
        input.status,
        input.decision,
      );
      await audit.appendAuditLog({
        actorUserId,
        action: `dispute.${input.status.toLowerCase()}`,
        entityType: "dispute",
        entityId: id,
        metadata: { stakeStatus: input.stakeStatus },
      });
      return dispute;
    },
  };
}
