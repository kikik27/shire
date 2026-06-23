import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  AuthenticatedUserConfigurationError,
  AuthenticatedUserError,
  resolveAuthenticatedUser,
} from "../lib/server/authenticated-user";
import {
  closeSharedDatabase,
  createDatabase,
  DatabaseConfigurationError,
  type DatabaseDependencies,
} from "../lib/server/db";
import * as schema from "../lib/server/db/schema";
import {
  buildProfileUserUpsertQuery,
  buildProfileUserOnboardingDoneQuery,
  buildRoleProfileUpsertQuery,
  createDrizzleProfileRepository,
  createInMemoryProfileRepository,
  ProfileRepositoryError,
  type ProfileTransactionStore,
} from "../lib/server/profile-repository";

function requestWithBearer(token: string, body?: unknown) {
  return new Request("http://localhost", {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const configuredDependencies = {
  appId: "app-id",
  appSecret: "secret",
  verifyAccessToken: async () => ({ userId: "did:privy:real-user" }),
};

test("verified Privy identity is returned instead of browser identity", async () => {
  const identity = await resolveAuthenticatedUser(
    requestWithBearer("token", {
      userId: "did:privy:browser-controlled",
    }),
    configuredDependencies,
  );

  assert.deepEqual(identity, {
    mode: "privy",
    privyUserId: "did:privy:real-user",
  });
});

test("configured Privy rejects a missing token", async () => {
  await assert.rejects(
    resolveAuthenticatedUser(
      new Request("http://localhost"),
      configuredDependencies,
    ),
    AuthenticatedUserError,
  );
});

test("configured Privy rejects an invalid token", async () => {
  await assert.rejects(
    resolveAuthenticatedUser(requestWithBearer("invalid"), {
      ...configuredDependencies,
      verifyAccessToken: async () => {
        throw new Error("invalid token");
      },
    }),
    AuthenticatedUserError,
  );
});

test("demo identity is allowed only when both Privy credentials are absent", async () => {
  assert.deepEqual(
    await resolveAuthenticatedUser(new Request("http://localhost"), {
      appId: undefined,
      appSecret: undefined,
      nodeEnv: "development",
      verifyAccessToken: async () => ({ userId: "unused" }),
    }),
    { mode: "demo", privyUserId: "demo-user" },
  );
});

test("production rejects missing Privy configuration", async () => {
  await assert.rejects(
    resolveAuthenticatedUser(new Request("http://localhost"), {
      appId: undefined,
      appSecret: undefined,
      nodeEnv: "production",
      verifyAccessToken: async () => ({ userId: "unused" }),
    }),
    AuthenticatedUserConfigurationError,
  );
});

test("partial Privy configuration is distinct from authentication failure", async () => {
  await assert.rejects(
    resolveAuthenticatedUser(new Request("http://localhost"), {
      appId: "app-id",
      appSecret: undefined,
      nodeEnv: "development",
      verifyAccessToken: async () => ({ userId: "unused" }),
    }),
    (error: unknown) =>
      error instanceof AuthenticatedUserConfigurationError &&
      !(error instanceof AuthenticatedUserError),
  );
});

test("database creation is lazy, configurable, and closeable", async () => {
  assert.throws(
    () => createDatabase({ url: " " }),
    DatabaseConfigurationError,
  );

  let receivedUrl = "";
  let receivedPrepare: boolean | undefined;
  let closeCalls = 0;
  let client: ReturnType<typeof postgres> | undefined;
  const database = createDatabase({
    url: "postgres://runtime.example/shire",
    createClient: (url, options) => {
      receivedUrl = url;
      receivedPrepare = options.prepare;
      client = postgres(url, options);
      const end = client.end.bind(client);
      client.end = async (endOptions) => {
        closeCalls += 1;
        await end(endOptions);
      };
      return client;
    },
  });

  assert.equal(receivedUrl, "postgres://runtime.example/shire");
  assert.equal(receivedPrepare, false);
  assert.equal(database.$client, client);
  assert.equal(database.ownership, "owned");
  await database.close();
  await database.close();
  assert.equal(closeCalls, 1);
});

test("shared database construction reuses one pool and requires explicit shutdown", async () => {
  let clientsCreated = 0;
  let closeCalls = 0;
  const createClient: NonNullable<DatabaseDependencies["createClient"]> = (
    url,
    options,
  ) => {
    clientsCreated += 1;
    const client = postgres(url, options);
    const end = client.end.bind(client);
    client.end = async (endOptions) => {
      closeCalls += 1;
      await end(endOptions);
    };
    return client;
  };

  const first = createDatabase({
    url: "postgres://shared.example/shire",
    createClient,
    shared: true,
  });
  const second = createDatabase({
    url: "postgres://shared.example/shire",
    createClient,
    shared: true,
  });

  assert.equal(first, second);
  assert.equal(first.ownership, "shared");
  assert.equal(clientsCreated, 1);

  await first.close();
  assert.equal(closeCalls, 0);

  await closeSharedDatabase(first);
  assert.equal(closeCalls, 1);
});

test("one user can own candidate and recruiter profiles", async () => {
  const repository = createInMemoryProfileRepository();
  const user = await repository.resolveUser("did:privy:one");
  const sameUser = await repository.resolveUser("did:privy:one");
  const candidateProfile = { displayName: "Candidate One" };
  const recruiterProfile = { displayName: "Recruiter One" };

  await repository.upsertProfile(user.id, "candidate", candidateProfile);
  await repository.upsertProfile(user.id, "recruiter", recruiterProfile);

  assert.deepEqual(sameUser, user);
  assert.deepEqual(
    await repository.getProfile(user.id, "candidate"),
    candidateProfile,
  );
  assert.deepEqual(
    await repository.getProfile(user.id, "recruiter"),
    recruiterProfile,
  );
  assert.deepEqual(await repository.listActiveRoles(user.id), [
    "candidate",
    "recruiter",
  ]);
});

test("profile upsert replaces the saved role profile", async () => {
  const repository = createInMemoryProfileRepository();
  const user = await repository.resolveUser("did:privy:one");

  await repository.upsertProfile(user.id, "candidate", { version: 1 });
  const updated = await repository.upsertProfile(user.id, "candidate", {
    version: 2,
  });

  assert.deepEqual(updated, { version: 2 });
  assert.deepEqual(await repository.getProfile(user.id, "candidate"), {
    version: 2,
  });
});

test("atomic profile save resolves the user and persists the role", async () => {
  const repository = createInMemoryProfileRepository();

  const saved = await repository.saveProfileForPrivyUser(
    " did:privy:atomic ",
    "candidate",
    { displayName: "Atomic Candidate" },
  );

  assert.equal(saved.user.privyUserId, "did:privy:atomic");
  assert.deepEqual(saved.profile, { displayName: "Atomic Candidate" });
  assert.deepEqual(
    await repository.getProfile(saved.user.id, "candidate"),
    saved.profile,
  );
});

test("atomic profile save marks the user onboarding as done", async () => {
  const repository = createInMemoryProfileRepository();

  const saved = await repository.saveProfileForPrivyUser(
    "did:privy:onboarded",
    "candidate",
    { displayName: "Onboarded Candidate" },
  );

  assert.equal(saved.user.onboardingDone, true);
  assert.equal(
    (await repository.resolveUser("did:privy:onboarded")).onboardingDone,
    true,
  );
});

test("Drizzle atomic profile save rolls back when the profile upsert fails", async () => {
  const committedUsers = new Map<string, string>();
  let transactionCalls = 0;
  const transactionStore: ProfileTransactionStore = {
    async resolveUser(privyUserId) {
      return { id: "user-1", privyUserId, walletAddress: null, onboardingDone: false };
    },
    async upsertProfile() {
      throw new Error("profile write failed");
    },
    async markOnboardingDone() {
      throw new Error("onboarding should not be marked after profile failure");
    },
  };
  const repository = createDrizzleProfileRepository(undefined, {
    runTransaction: async (operation) => {
      transactionCalls += 1;
      const stagedUsers = new Map(committedUsers);
      const stagedStore: ProfileTransactionStore = {
        ...transactionStore,
        async resolveUser(privyUserId) {
          const user = await transactionStore.resolveUser(privyUserId);
          stagedUsers.set(privyUserId, user.id);
          return user;
        },
      };
      const result = await operation(stagedStore);
      committedUsers.clear();
      for (const [privyUserId, userId] of stagedUsers) {
        committedUsers.set(privyUserId, userId);
      }
      return result;
    },
  });

  await assert.rejects(
    repository.saveProfileForPrivyUser(
      "did:privy:rollback",
      "candidate",
      { displayName: "Rollback Candidate" },
    ),
    ProfileRepositoryError,
  );

  assert.equal(transactionCalls, 1);
  assert.equal(committedUsers.size, 0);
});

test("Drizzle atomic profile save uses one transaction store for both writes", async () => {
  const calls: string[] = [];
  const repository = createDrizzleProfileRepository(undefined, {
    runTransaction: async (operation) =>
      operation({
        async resolveUser(privyUserId) {
          calls.push(`user:${privyUserId}`);
          return { id: "user-1", privyUserId, walletAddress: null, onboardingDone: false };
        },
        async upsertProfile(userId, role, profile) {
          calls.push(`profile:${userId}:${role}`);
          return profile;
        },
        async markOnboardingDone(userId) {
          calls.push(`onboarding:${userId}`);
          return {
            id: userId,
            privyUserId: "did:privy:query",
            walletAddress: null,
            onboardingDone: true,
          };
        },
      }),
  });

  const saved = await repository.saveProfileForPrivyUser(
    " did:privy:query ",
    "recruiter",
    { company: "Shire" },
  );

  assert.deepEqual(calls, [
    "user:did:privy:query",
    "profile:user-1:recruiter",
    "onboarding:user-1",
  ]);
  assert.deepEqual(saved, {
    user: {
      id: "user-1",
      privyUserId: "did:privy:query",
      walletAddress: null,
      onboardingDone: true,
    },
    profile: { company: "Shire" },
  });
});

test("Drizzle profile persistence builds conflict-update upserts", () => {
  const database = drizzle.mock({ schema });

  const userQuery = buildProfileUserUpsertQuery(
    database,
    "did:privy:sql",
  ).toSQL();
  const profileQuery = buildRoleProfileUpsertQuery(
    database,
    "user-1",
    "candidate",
    { displayName: "SQL Candidate" },
  ).toSQL();
  const onboardingQuery = buildProfileUserOnboardingDoneQuery(
    database,
    "user-1",
  ).toSQL();

  assert.match(userQuery.sql, /insert into "app_users"/);
  assert.match(userQuery.sql, /on conflict \("privy_user_id"\) do update/);
  assert.match(profileQuery.sql, /insert into "candidate_profiles"/);
  assert.match(profileQuery.sql, /on conflict \("user_id"\) do update/);
  assert.match(profileQuery.sql, /"profile_status"/);
  assert.ok(profileQuery.params.includes("CONFIRMED"));
  assert.match(onboardingQuery.sql, /update "app_users"/);
  assert.match(onboardingQuery.sql, /"onboarding_done" = \$1/);
});
