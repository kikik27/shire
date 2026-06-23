import { env } from "../../env";
import {
  createAgentDatabase,
  AgentDatabaseConfigurationError,
  type AgentDatabase,
  type AgentDatabaseDependencies,
} from "./client";

export {
  createAgentDatabase,
  AgentDatabaseConfigurationError,
  type AgentDatabase,
  type AgentDatabaseDependencies,
};

/**
 * Lazily resolve the shared agent database, or return null when no URL is
 * configured. The agent must still serve chat and product-Q&A without a
 * Postgres connection; only matching jobs require the database. Callers that
 * need the DB should check for null and fail the matching job with a clear
 * reason rather than crashing the process.
 */
export function getAgentDatabase(
  dependencies: AgentDatabaseDependencies = {},
): AgentDatabase | null {
  const url = (dependencies.url ?? env.agentDatabaseUrl)?.trim();
  if (!url) {
    return null;
  }
  return createAgentDatabase({ ...dependencies, url });
}
