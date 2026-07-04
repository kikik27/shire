import { and, desc, eq, inArray } from "drizzle-orm";
import type { DisputeStatus } from "@shire/shared";

import type { PlatformDispute } from "../types";
import { createDatabase, type Database } from "./db";
import { disputes } from "./db/schema";

export type CreateDisputeInput = {
  reporterUserId: string;
  jobId?: string;
  stakeId?: string;
  reason: string;
  aiSummary?: string;
};

export interface DisputesRepository {
  createDispute(input: CreateDisputeInput): Promise<PlatformDispute>;
  listDisputes(): Promise<PlatformDispute[]>;
  getDispute(id: string): Promise<PlatformDispute | null>;
  resolveDispute(
    id: string,
    status: Extract<DisputeStatus, "RESOLVED" | "REJECTED">,
    decision: string,
  ): Promise<PlatformDispute>;
}

export class DisputeNotFoundError extends Error {
  readonly code = "dispute-not-found";
}

export class DisputeTransitionError extends Error {
  readonly code = "invalid-transition";
}

function timestamp(value: Date | number) {
  return value instanceof Date ? value.getTime() : value;
}

export function mapDispute(
  row: typeof disputes.$inferSelect,
): PlatformDispute {
  return {
    id: row.id,
    reporterUserId: row.reporterUserId,
    jobId: row.jobId ?? undefined,
    stakeId: row.stakeId ?? undefined,
    reason: row.reason,
    status: row.status,
    aiSummary: row.aiSummary ?? undefined,
    adminDecision: row.adminDecision ?? undefined,
    createdAt: timestamp(row.createdAt),
    updatedAt: timestamp(row.updatedAt),
  };
}

export function createDrizzleDisputesRepository(
  database: Database = createDatabase(),
): DisputesRepository {
  return {
    async createDispute(input) {
      const [row] = await database.insert(disputes).values(input).returning();
      if (!row) throw new Error("Dispute insert returned no row.");
      return mapDispute(row);
    },
    async listDisputes() {
      const rows = await database
        .select()
        .from(disputes)
        .orderBy(desc(disputes.createdAt));
      return rows.map(mapDispute);
    },
    async getDispute(id) {
      const [row] = await database
        .select()
        .from(disputes)
        .where(eq(disputes.id, id))
        .limit(1);
      return row ? mapDispute(row) : null;
    },
    async resolveDispute(id, status, decision) {
      const [row] = await database
        .update(disputes)
        .set({ status, adminDecision: decision, updatedAt: new Date() })
        .where(
          and(
            eq(disputes.id, id),
            inArray(disputes.status, ["OPEN", "UNDER_REVIEW"]),
          ),
        )
        .returning();
      if (row) return mapDispute(row);
      const [existing] = await database
        .select({ id: disputes.id })
        .from(disputes)
        .where(eq(disputes.id, id))
        .limit(1);
      if (!existing) {
        throw new DisputeNotFoundError("Dispute was not found.");
      }
      throw new DisputeTransitionError("Dispute is already resolved.");
    },
  };
}

export function createInMemoryDisputesRepository(): DisputesRepository {
  const stored = new Map<string, PlatformDispute>();
  return {
    async createDispute(input) {
      const now = Date.now();
      const dispute: PlatformDispute = {
        id: crypto.randomUUID(),
        ...input,
        status: "OPEN",
        createdAt: now,
        updatedAt: now,
      };
      stored.set(dispute.id, dispute);
      return dispute;
    },
    async listDisputes() {
      return [...stored.values()].sort((a, b) => b.createdAt - a.createdAt);
    },
    async getDispute(id) {
      return stored.get(id) ?? null;
    },
    async resolveDispute(id, status, decision) {
      const dispute = stored.get(id);
      if (!dispute) {
        throw new DisputeNotFoundError("Dispute was not found.");
      }
      if (dispute.status === "RESOLVED" || dispute.status === "REJECTED") {
        throw new DisputeTransitionError("Dispute is already resolved.");
      }
      const updated = {
        ...dispute,
        status,
        adminDecision: decision,
        updatedAt: Date.now(),
      };
      stored.set(id, updated);
      return updated;
    },
  };
}
