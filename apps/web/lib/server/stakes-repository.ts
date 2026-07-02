import { and, desc, eq } from "drizzle-orm";
import type { PlatformStakeStatus, PlatformStakeType } from "@shire/shared";

import type { PlatformStake, TokenSymbol } from "../types";
import { createDatabase, type Database } from "./db";
import { stakes } from "./db/schema";

export type CreateStakeInput = {
  ownerUserId: string;
  jobId?: string;
  applicationId?: string;
  type: PlatformStakeType;
  amount: number;
  token: TokenSymbol;
  idempotencyKey: string;
  reason?: string;
};

export interface StakesRepository {
  createStake(input: CreateStakeInput): Promise<PlatformStake>;
  listStakesByOwner(ownerUserId: string): Promise<PlatformStake[]>;
  listStakes(): Promise<PlatformStake[]>;
  getStake(id: string): Promise<PlatformStake | null>;
  transitionStake(
    id: string,
    status: Exclude<PlatformStakeStatus, "LOCKED">,
    actorUserId: string,
    reason?: string,
  ): Promise<PlatformStake>;
}

export class StakeNotFoundError extends Error {
  readonly code = "stake-not-found";
}

export class StakeConflictError extends Error {
  readonly code = "idempotency-conflict";
}

export class StakeTransitionError extends Error {
  readonly code = "invalid-transition";
}

function numericValue(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

function timestamp(value: Date | number) {
  return value instanceof Date ? value.getTime() : value;
}

export function mapStake(row: typeof stakes.$inferSelect): PlatformStake {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    jobId: row.jobId ?? undefined,
    applicationId: row.applicationId ?? undefined,
    type: row.type,
    amount: numericValue(row.amount),
    token: row.token as TokenSymbol,
    status: row.status,
    idempotencyKey: row.idempotencyKey,
    reason: row.reason ?? undefined,
    createdAt: timestamp(row.createdAt),
    updatedAt: timestamp(row.updatedAt),
  };
}

function sameStakeInput(stake: PlatformStake, input: CreateStakeInput) {
  return (
    stake.ownerUserId === input.ownerUserId &&
    stake.jobId === input.jobId &&
    stake.applicationId === input.applicationId &&
    stake.type === input.type &&
    stake.amount === input.amount &&
    stake.token === input.token
  );
}

export function createDrizzleStakesRepository(
  database: Database = createDatabase(),
): StakesRepository {
  return {
    async createStake(input) {
      const [created] = await database
        .insert(stakes)
        .values({
          ownerUserId: input.ownerUserId,
          jobId: input.jobId,
          applicationId: input.applicationId,
          type: input.type,
          amount: String(input.amount),
          token: input.token,
          idempotencyKey: input.idempotencyKey,
          reason: input.reason,
        })
        .onConflictDoNothing({
          target: [stakes.ownerUserId, stakes.idempotencyKey],
        })
        .returning();
      if (created) {
        return mapStake(created);
      }
      const [existing] = await database
        .select()
        .from(stakes)
        .where(
          and(
            eq(stakes.ownerUserId, input.ownerUserId),
            eq(stakes.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (!existing) {
        throw new Error("Idempotent stake lookup returned no row.");
      }
      const mapped = mapStake(existing);
      if (!sameStakeInput(mapped, input)) {
        throw new StakeConflictError(
          "The idempotency key was already used for another stake.",
        );
      }
      return mapped;
    },
    async listStakesByOwner(ownerUserId) {
      const rows = await database
        .select()
        .from(stakes)
        .where(eq(stakes.ownerUserId, ownerUserId))
        .orderBy(desc(stakes.createdAt));
      return rows.map(mapStake);
    },
    async listStakes() {
      const rows = await database
        .select()
        .from(stakes)
        .orderBy(desc(stakes.createdAt));
      return rows.map(mapStake);
    },
    async getStake(id) {
      const [row] = await database
        .select()
        .from(stakes)
        .where(eq(stakes.id, id))
        .limit(1);
      return row ? mapStake(row) : null;
    },
    async transitionStake(id, status, _actorUserId, reason) {
      const [row] = await database
        .update(stakes)
        .set({ status, reason, updatedAt: new Date() })
        .where(and(eq(stakes.id, id), eq(stakes.status, "LOCKED")))
        .returning();
      if (row) {
        return mapStake(row);
      }
      const [existing] = await database
        .select({ id: stakes.id })
        .from(stakes)
        .where(eq(stakes.id, id))
        .limit(1);
      if (!existing) {
        throw new StakeNotFoundError("Stake was not found.");
      }
      throw new StakeTransitionError("Stake is already settled.");
    },
  };
}

export function createInMemoryStakesRepository(): StakesRepository {
  const stored = new Map<string, PlatformStake>();

  return {
    async createStake(input) {
      const existing = [...stored.values()].find(
        (stake) =>
          stake.ownerUserId === input.ownerUserId &&
          stake.idempotencyKey === input.idempotencyKey,
      );
      if (existing) {
        if (!sameStakeInput(existing, input)) {
          throw new StakeConflictError(
            "The idempotency key was already used for another stake.",
          );
        }
        return existing;
      }
      const now = Date.now();
      const stake: PlatformStake = {
        id: crypto.randomUUID(),
        ...input,
        status: "LOCKED",
        createdAt: now,
        updatedAt: now,
      };
      stored.set(stake.id, stake);
      return stake;
    },
    async listStakesByOwner(ownerUserId) {
      return [...stored.values()]
        .filter((stake) => stake.ownerUserId === ownerUserId)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    async listStakes() {
      return [...stored.values()].sort((a, b) => b.createdAt - a.createdAt);
    },
    async getStake(id) {
      return stored.get(id) ?? null;
    },
    async transitionStake(id, status, _actorUserId, reason) {
      const stake = stored.get(id);
      if (!stake) {
        throw new StakeNotFoundError("Stake was not found.");
      }
      if (stake.status !== "LOCKED") {
        throw new StakeTransitionError("Stake is already settled.");
      }
      const updated = {
        ...stake,
        status,
        reason,
        updatedAt: Date.now(),
      };
      stored.set(id, updated);
      return updated;
    },
  };
}
