import assert from "node:assert/strict";
import test from "node:test";

import { createEnv } from "../src/env";

test("defaults autonomy mode to semi-autonomous", () => {
  const env = createEnv({});

  assert.equal(env.autonomyMode, "semi-autonomous");
  assert.equal(env.logLevel, "debug");
  assert.equal(env.prettyLogs, true);
  assert.equal("openAiApiKey" in env, false);
  assert.equal("openRouterApiKey" in env, false);
  assert.equal("tokenRouterApiKey" in env, false);
});

test("defaults capability model, memory, and knowledge config", () => {
  const env = createEnv({});

  assert.deepEqual(env.chatModelChains.default, ["MiniMax-M3"]);
  assert.deepEqual(
    env.chatModelChains.productQna,
    env.chatModelChains.default,
  );
  assert.deepEqual(
    env.chatModelChains.disputeSummary,
    env.chatModelChains.default,
  );
  assert.equal(env.embeddingModels.default, "text-embedding-3-small");
  assert.equal(env.embeddingModels.memory, "text-embedding-3-small");
  assert.equal(
    env.embeddingModels.productKnowledge,
    "text-embedding-3-small",
  );
  assert.equal(
    env.embeddingModels.repositoryKnowledge,
    "text-embedding-3-small",
  );
  assert.equal(env.textModelProvider, "tokenrouter");
  assert.equal(env.textModelBaseUrl, "https://api.tokenrouter.com/v1");
  assert.equal(env.textModelApiKey, undefined);
  assert.equal(env.embeddingProvider, "openai");
  assert.equal(env.embeddingApiKey, undefined);
  assert.equal(env.embeddingBaseUrls.default, "https://api.openai.com/v1");
  assert.equal(env.embeddingBaseUrls.memory, "https://api.openai.com/v1");
  assert.equal(
    env.embeddingBaseUrls.productKnowledge,
    "https://api.openai.com/v1",
  );
  assert.equal(
    env.embeddingBaseUrls.repositoryKnowledge,
    "https://api.openai.com/v1",
  );
  assert.equal(env.embeddingEnabled, false);
  assert.equal(env.workingMemoryEnabled, false);
  assert.equal(env.agentMemoryUrl, "file:./.data/shire-agent-memory.db");
  assert.equal(env.agentMemoryAuthToken, undefined);
  assert.equal(env.agentKnowledgeUrl, "file:./.data/shire-agent-knowledge.db");
  assert.equal(env.agentKnowledgeAuthToken, undefined);
  assert.equal(
    env.agentKnowledgeManifestUrl,
    "file:./.data/shire-agent-knowledge.db",
  );
  assert.equal(env.agentKnowledgeManifestAuthToken, undefined);
  assert.equal(env.agentKnowledgeIndex, "shire_context");
  assert.equal(env.ragTopK, 5);
  assert.equal(env.ragMaxCharacters, 8_000);
  assert.equal(env.workerEnabled, true);
  assert.equal(env.recommendationSchedulerEnabled, true);
  assert.equal(env.recommendationSchedulerIntervalMs, 15 * 60 * 1000);
});

test("defaults bounded chat security config", () => {
  const env = createEnv({});

  assert.equal(env.chatMaxBodyBytes, 65_536);
  assert.equal(env.chatMaxMessages, 50);
  assert.equal(env.chatMaxMessageCharacters, 8_000);
  assert.equal(env.chatRateLimitRequests, 30);
  assert.equal(env.chatRateLimitWindowSeconds, 60);
  assert.equal("securityGuardEnabled" in env, false);
  assert.equal("securityGuardMode" in env, false);
  assert.equal("securityGuardModels" in env, false);
  assert.equal(env.securityGuardThreshold, 0.85);
  assert.equal(env.outputMaxCharacters, 12_000);
});

test("defaults durable job and CV upload config", () => {
  const env = createEnv({});

  assert.equal(env.redisUrl, undefined);
  assert.equal(env.agentServiceToken, undefined);
  assert.equal(env.jobQueueName, "shire-agent-jobs");
  assert.equal(env.jobAttempts, 3);
  assert.equal(env.jobBackoffMs, 5_000);
  assert.equal(env.cvMaxFileBytes, 5 * 1024 * 1024);
});

test("parses chat model capabilities from env", () => {
  const env = createEnv({
    SHIRE_TEXT_MODEL: "tokenrouter/default-a,tokenrouter/default-b",
    SHIRE_MODEL_PRODUCT_QNA: "openrouter/product",
    SHIRE_MODEL_ROLE_AWARE_CHAT: "openrouter/role-aware",
    SHIRE_MODEL_DISPUTE_SUMMARY: "openrouter/dispute",
    SHIRE_MODEL_KNOWLEDGE_SYNTHESIS: "openrouter/knowledge",
    SHIRE_MODEL_RECOMMENDATION_EXPLANATION: "openrouter/recommendation",
    SHIRE_MODEL_WORKFLOW_SUMMARY: "openrouter/workflow",
    SHIRE_TEXT_API_KEY: "text-key",
  });

  assert.deepEqual(env.chatModelChains.default, [
    "tokenrouter/default-a",
    "tokenrouter/default-b",
  ]);
  assert.equal(env.textModelApiKey, "text-key");
  assert.deepEqual(env.chatModelChains.productQna, ["openrouter/product"]);
  assert.deepEqual(
    env.chatModelChains.roleAwareChat,
    env.chatModelChains.default,
  );
  assert.deepEqual(
    env.chatModelChains.disputeSummary,
    env.chatModelChains.default,
  );
  assert.deepEqual(
    env.chatModelChains.knowledgeSynthesis,
    env.chatModelChains.default,
  );
  assert.deepEqual(
    env.chatModelChains.recommendationExplanation,
    env.chatModelChains.default,
  );
  assert.deepEqual(
    env.chatModelChains.workflowSummary,
    env.chatModelChains.default,
  );
  assert.deepEqual(env.chatModelChains.cvNormalization, [
    "tokenrouter/default-a",
    "tokenrouter/default-b",
  ]);
});

test("ignores legacy database, model, and API key aliases", () => {
  const env = createEnv({
    DATABASE_URL: "postgres://legacy",
    TOKENROUTER_API_KEY: "legacy-tokenrouter",
    OPENAI_API_KEY: "legacy-openai",
    OPENROUTER_API_KEY: "legacy-openrouter",
    SHIRE_MODEL_DEFAULT: "legacy/default",
    SHIRE_EMBEDDING_MODEL_DEFAULT: "legacy-embedding",
    SHIRE_EMBEDDING_BASE_URL_DEFAULT: "https://legacy-embedding.test/v1",
  });

  assert.equal(env.agentDatabaseUrl, undefined);
  assert.equal(env.textModelApiKey, undefined);
  assert.equal(env.embeddingApiKey, undefined);
  assert.equal(env.embeddingEnabled, false);
  assert.deepEqual(env.chatModelChains.default, ["MiniMax-M3"]);
  assert.equal(env.embeddingModels.default, "text-embedding-3-small");
  assert.equal(env.embeddingBaseUrls.default, "https://api.openai.com/v1");
});

test("parses embedding capabilities from env", () => {
  const env = createEnv({
    SHIRE_TEXT_MODEL: "tokenrouter/default",
    SHIRE_EMBEDDING_MODEL: "embedding/default",
    SHIRE_EMBEDDING_MODEL_MEMORY: "embedding/memory",
    SHIRE_EMBEDDING_BASE_URL: "https://example.test/v1/",
    SHIRE_EMBEDDING_BASE_URL_PRODUCT_KNOWLEDGE: "https://product.test/v1/",
    SHIRE_EMBEDDING_API_KEY: "embedding-key",
  });

  assert.equal(env.embeddingModels.default, "embedding/default");
  assert.equal(env.embeddingModels.memory, "embedding/memory");
  assert.equal(env.embeddingModels.productKnowledge, "embedding/default");
  assert.equal(env.embeddingBaseUrls.default, "https://example.test/v1");
  assert.equal(
    env.embeddingBaseUrls.productKnowledge,
    "https://product.test/v1",
  );
  assert.equal(
    env.embeddingBaseUrls.repositoryKnowledge,
    "https://example.test/v1",
  );
  assert.equal(env.embeddingApiKey, "embedding-key");
  assert.equal(env.embeddingEnabled, true);
});

test("parses persistent libsql storage config from env", () => {
  const env = createEnv({
    SHIRE_AGENT_MEMORY_URL: "libsql://shire-agent-memory-labsmula.aws-ap-northeast-1.turso.io",
    SHIRE_AGENT_MEMORY_AUTH_TOKEN: "memory-token",
    SHIRE_AGENT_KNOWLEDGE_URL: "libsql://shire-agent-knowledge.example.turso.io",
    SHIRE_AGENT_KNOWLEDGE_AUTH_TOKEN: "knowledge-token",
    SHIRE_AGENT_KNOWLEDGE_MANIFEST_URL:
      "libsql://shire-agent-manifest.example.turso.io",
    SHIRE_AGENT_KNOWLEDGE_MANIFEST_AUTH_TOKEN: "manifest-token",
  });

  assert.equal(
    env.agentMemoryUrl,
    "libsql://shire-agent-memory-labsmula.aws-ap-northeast-1.turso.io",
  );
  assert.equal(env.agentMemoryAuthToken, "memory-token");
  assert.equal(
    env.agentKnowledgeUrl,
    "libsql://shire-agent-knowledge.example.turso.io",
  );
  assert.equal(env.agentKnowledgeAuthToken, "knowledge-token");
  assert.equal(
    env.agentKnowledgeManifestUrl,
    "libsql://shire-agent-manifest.example.turso.io",
  );
  assert.equal(env.agentKnowledgeManifestAuthToken, "manifest-token");
});

test("defaults knowledge manifest storage to knowledge storage", () => {
  const env = createEnv({
    SHIRE_AGENT_KNOWLEDGE_URL: "libsql://shire-agent-knowledge.example.turso.io",
    SHIRE_AGENT_KNOWLEDGE_AUTH_TOKEN: "knowledge-token",
  });

  assert.equal(
    env.agentKnowledgeManifestUrl,
    "libsql://shire-agent-knowledge.example.turso.io",
  );
  assert.equal(env.agentKnowledgeManifestAuthToken, "knowledge-token");
});

test("parses a valid autonomy mode from SHIRE_AUTONOMY_MODE", () => {
  const env = createEnv({ SHIRE_AUTONOMY_MODE: "fully-autonomous" });

  assert.equal(env.autonomyMode, "fully-autonomous");
});

test("rejects an invalid autonomy mode", () => {
  assert.throws(() => createEnv({ SHIRE_AUTONOMY_MODE: "wide-open" }));
});

test("parses custom agent config from environment variables", () => {
  const env = createEnv({
    NODE_ENV: "production",
    SHIRE_LOG_LEVEL: "warn",
    SHIRE_PRETTY_LOGS: "false",
    SHIRE_EMBEDDING_ENABLED: "true",
    SHIRE_WORKING_MEMORY_ENABLED: "true",
    SHIRE_EMBEDDING_BASE_URL: "https://embedding.example/v1/",
    SHIRE_WORKER_ENABLED: "false",
    SHIRE_RECOMMENDATION_SCHEDULER_ENABLED: "false",
    SHIRE_RECOMMENDATION_SCHEDULER_INTERVAL_MS: "60000",
    REDIS_URL: "rediss://redis.example:6379",
    SHIRE_AGENT_SERVICE_TOKEN: "secret",
    SHIRE_JOB_QUEUE_NAME: "custom-jobs",
    SHIRE_JOB_ATTEMPTS: "4",
    SHIRE_JOB_BACKOFF_MS: "7000",
    SHIRE_CV_MAX_FILE_BYTES: "6000000",
  });

  assert.equal(env.logLevel, "warn");
  assert.equal(env.prettyLogs, false);
  assert.equal(env.embeddingEnabled, true);
  assert.equal(env.workingMemoryEnabled, true);
  assert.equal(env.embeddingBaseUrls.default, "https://embedding.example/v1");
  assert.equal(env.workerEnabled, false);
  assert.equal(env.recommendationSchedulerEnabled, false);
  assert.equal(env.recommendationSchedulerIntervalMs, 60_000);
  assert.equal(env.redisUrl, "rediss://redis.example:6379");
  assert.equal(env.agentServiceToken, "secret");
  assert.equal(env.jobQueueName, "custom-jobs");
  assert.equal(env.jobAttempts, 4);
  assert.equal(env.jobBackoffMs, 7_000);
  assert.equal(env.cvMaxFileBytes, 6_000_000);
});

test("rejects invalid positive integer config", () => {
  assert.throws(() => createEnv({ SHIRE_RAG_TOP_K: "0" }));
});

test("rejects invalid security threshold config", () => {
  assert.throws(() => createEnv({ SHIRE_SECURITY_GUARD_THRESHOLD: "-0.01" }));
  assert.throws(() => createEnv({ SHIRE_SECURITY_GUARD_THRESHOLD: "1.01" }));
  assert.equal(
    createEnv({ SHIRE_SECURITY_GUARD_THRESHOLD: "0.42" })
      .securityGuardThreshold,
    0.42,
  );
});
