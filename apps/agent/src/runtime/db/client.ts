import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Options, type PostgresType, type Sql } from "postgres";

import * as schema from "./schema";

/**
 * Agent-side Postgres client. The agent reads candidate/job profiles and writes
 * recommendations + agent_runs to the same database the web app owns. The URL
 * is resolved from SHIRE_AGENT_DATABASE_URL (falling back to DATABASE_URL) in
 * env.ts.
 *
 * Mirrors the web client's singleton-by-URL pattern so repeated calls within a
 * process share one connection pool, and tests can construct an owned
 * (non-shared) client.
 */
export class AgentDatabaseConfigurationError extends Error {
  constructor() {
    super(
      "SHIRE_AGENT_DATABASE_URL (or DATABASE_URL) is required for matching jobs.",
    );
    this.name = "AgentDatabaseConfigurationError";
  }
}

type PostgresOptions = Options<Record<string, PostgresType>>;

export type AgentDatabaseDependencies = {
  url?: string;
  createClient?: (url: string, options: PostgresOptions) => Sql;
  shared?: boolean;
};

type DatabaseOwnership = "owned" | "shared";
type ClientFactory = NonNullable<AgentDatabaseDependencies["createClient"]>;

const sharedDatabases = new WeakMap<ClientFactory, Map<string, AgentDatabase>>();
const databaseClosers = new WeakMap<AgentDatabase, () => Promise<void>>();
const sharedDatabaseRemovers = new WeakMap<AgentDatabase, () => void>();

function buildAgentDatabase(client: Sql, ownership: DatabaseOwnership) {
  let closed = false;
  const database = Object.assign(drizzle(client, { schema }), {
    ownership,
    async close() {
      if (ownership === "shared" || closed) {
        return;
      }
      closed = true;
      await client.end();
    },
  });
  databaseClosers.set(database, async () => {
    if (closed) {
      return;
    }
    closed = true;
    await client.end();
  });
  return database;
}

export type AgentDatabase = ReturnType<typeof buildAgentDatabase>;

export function createAgentDatabase(
  dependencies: AgentDatabaseDependencies = {},
): AgentDatabase {
  const url = dependencies.url?.trim();
  if (!url) {
    throw new AgentDatabaseConfigurationError();
  }

  const createClient = dependencies.createClient ?? postgres;
  const shared = dependencies.shared ?? Object.keys(dependencies).length === 0;
  if (shared) {
    const databasesForFactory =
      sharedDatabases.get(createClient) ?? new Map<string, AgentDatabase>();
    sharedDatabases.set(createClient, databasesForFactory);
    const existing = databasesForFactory.get(url);
    if (existing) {
      return existing;
    }
    const database = buildAgentDatabase(
      createClient(url, { prepare: false }),
      "shared",
    );
    databasesForFactory.set(url, database);
    sharedDatabaseRemovers.set(database, () => {
      databasesForFactory.delete(url);
    });
    return database;
  }

  const client = createClient(url, { prepare: false });
  return buildAgentDatabase(client, "owned");
}

export async function closeSharedAgentDatabase(database: AgentDatabase) {
  if (database.ownership !== "shared") {
    return;
  }
  sharedDatabaseRemovers.get(database)?.();
  await databaseClosers.get(database)?.();
}
