const isolatedEnvironmentKeys = [
  "REDIS_URL",
  "DATABASE_URL",
  "SHIRE_AGENT_DATABASE_URL",
  "SHIRE_TEXT_PROVIDER",
  "SHIRE_TEXT_BASE_URL",
  "SHIRE_TEXT_MODEL",
  "SHIRE_MODEL_DEFAULT",
  "SHIRE_TEXT_API_KEY",
  "TOKENROUTER_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENAI_API_KEY",
  "SHIRE_EMBEDDING_API_KEY",
  "SHIRE_AGENT_MEMORY_URL",
  "SHIRE_AGENT_MEMORY_AUTH_TOKEN",
  "SHIRE_AGENT_KNOWLEDGE_URL",
  "SHIRE_AGENT_KNOWLEDGE_AUTH_TOKEN",
  "SHIRE_AGENT_KNOWLEDGE_MANIFEST_URL",
  "SHIRE_AGENT_KNOWLEDGE_MANIFEST_AUTH_TOKEN",
] as const;

for (const key of isolatedEnvironmentKeys) {
  delete process.env[key];
}

process.env.SHIRE_WORKER_ENABLED = "false";
process.env.SHIRE_RECOMMENDATION_SCHEDULER_ENABLED = "false";
process.env.SHIRE_EMBEDDING_ENABLED = "false";
process.env.SHIRE_LIVE_LLM_TESTS = "false";

// Prevent src/env.ts from restoring local .env values while it captures the
// deterministic test configuration.
for (const key of isolatedEnvironmentKeys) {
  process.env[key] = "";
}
await import("../src/env");
for (const key of isolatedEnvironmentKeys) {
  delete process.env[key];
}
