import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";

import { createDatabase } from "../lib/server/db";
import {
  appUsers,
  candidateProfiles,
  recruiterProfiles,
} from "../lib/server/db/schema";
import {
  createDrizzleProfileRepository,
  ProfileRepositoryError,
} from "../lib/server/profile-repository";

const liveTestEnabled =
  process.env.RUN_LIVE_PROFILE_TRANSACTION_TEST === "1";

test(
  "default Drizzle transaction rolls back user and profile writes",
  { skip: !liveTestEnabled },
  async () => {
    const databaseUrl =
      process.env.DIRECT_DATABASE_URL?.trim() ||
      process.env.DATABASE_URL?.trim();
    assert.ok(
      databaseUrl,
      "DIRECT_DATABASE_URL or DATABASE_URL is required for the live transaction test.",
    );

    const database = createDatabase({
      url: databaseUrl,
      shared: false,
    });
    const originalTransaction = database.transaction.bind(database);
    const rollbackError = new Error("force rollback after both writes");
    const privyUserId = `did:privy:live-rollback:${crypto.randomUUID()}`;
    let writtenUserId: string | undefined;

    database.transaction = (async (operation, config) =>
      originalTransaction(async (transaction) => {
        await operation(transaction);
        const [user] = await transaction
          .select({ id: appUsers.id })
          .from(appUsers)
          .where(eq(appUsers.privyUserId, privyUserId))
          .limit(1);
        assert.ok(user, "user write must be visible inside the transaction");
        writtenUserId = user.id;

        const [profile] = await transaction
          .select({ userId: candidateProfiles.userId })
          .from(candidateProfiles)
          .where(eq(candidateProfiles.userId, user.id))
          .limit(1);
        assert.ok(
          profile,
          "profile write must be visible inside the transaction",
        );

        throw rollbackError;
      }, config)) as typeof database.transaction;

    const repository = createDrizzleProfileRepository(database);

    try {
      await assert.rejects(
        repository.saveProfileForPrivyUser(
          privyUserId,
          "candidate",
          { displayName: "Live Rollback Candidate" },
        ),
        (error: unknown) =>
          error instanceof ProfileRepositoryError &&
          error.cause === rollbackError,
      );

      assert.ok(writtenUserId, "transaction must reach both writes");

      const usersAfterRollback = await database
        .select({ id: appUsers.id })
        .from(appUsers)
        .where(eq(appUsers.privyUserId, privyUserId));
      const profilesAfterRollback = await database
        .select({ userId: candidateProfiles.userId })
        .from(candidateProfiles)
        .where(eq(candidateProfiles.userId, writtenUserId));

      assert.deepEqual(usersAfterRollback, []);
      assert.deepEqual(profilesAfterRollback, []);
    } finally {
      if (writtenUserId) {
        await database
          .delete(candidateProfiles)
          .where(eq(candidateProfiles.userId, writtenUserId));
        await database
          .delete(recruiterProfiles)
          .where(eq(recruiterProfiles.userId, writtenUserId));
      }
      await database
        .delete(appUsers)
        .where(eq(appUsers.privyUserId, privyUserId));
      await database.close();
    }
  },
);
