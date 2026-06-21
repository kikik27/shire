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

  assert.deepEqual(env.chatModelChains.default, [
    "openrouter/nex-agi/nex-n2-pro:free",
    "openrouter/openai/gpt-oss-20b:free",
  ]);
  assert.deepEqual(
    env.chatModelChains.productQna,
    env.chatModelChains.default,
  );
  assert.deepEqual(
    env.chatModelChains.disputeSummary,
    env.chatModelChains.default,
  );
  assert.equal(env.embeddingModels.default, "qwen/qwen3-embedding-8b");
  assert.equal(env.embeddingModels.memory, "qwen/qwen3-embedding-8b");
  assert.equal(
    env.embeddingModels.productKnowledge,
    "qwen/qwen3-embedding-8b",
  );
  assert.equal(
    env.embeddingModels.repositoryKnowledge,
    "qwen/qwen3-embedding-8b",
  );
  assert.equal(env.embeddingBaseUrls.default, "https://openrouter.ai/api/v1");
  assert.equal(env.embeddingBaseUrls.memory, "https://openrouter.ai/api/v1");
  assert.equal(
    env.embeddingBaseUrls.productKnowledge,
    "https://openrouter.ai/api/v1",
  );
  assert.equal(
    env.embeddingBaseUrls.repositoryKnowledge,
    "https://openrouter.ai/api/v1",
  );
  assert.equal(env.embeddingEnabled, true);
  assert.equal(env.workingMemoryEnabled, false);
  assert.equal(env.agentMemoryUrl, "file:./.data/shire-agent-memory.db");
  assert.equal(env.agentKnowledgeUrl, "file:./.data/shire-agent-knowledge.db");
  assert.equal(env.agentKnowledgeIndex, "shire_context");
  assert.equal(env.ragTopK, 5);
  assert.equal(env.ragMaxCharacters, 8_000);
  assert.equal(env.workerEnabled, true);
  assert.equal(env.liveLlmTestsEnabled, false);
});

test("defaults bounded chat security config", () => {
  const env = createEnv({});

  assert.equal(env.chatMaxBodyBytes, 65_536);
  assert.equal(env.chatMaxMessages, 50);
  assert.equal(env.chatMaxMessageCharacters, 8_000);
  assert.equal(env.chatRateLimitRequests, 30);
  assert.equal(env.chatRateLimitWindowSeconds, 60);
  assert.equal(env.securityGuardEnabled, true);
  assert.equal(env.securityGuardMode, "suspicious-only");
  assert.deepEqual(env.securityGuardModels, [
    "openrouter/nex-agi/nex-n2-pro:free",
    "openrouter/openai/gpt-oss-20b:free",
  ]);
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
    SHIRE_MODEL_DEFAULT: "openrouter/default-a,openrouter/default-b",
    SHIRE_MODEL_PRODUCT_QNA: "openrouter/product",
    SHIRE_MODEL_DISPUTE_SUMMARY: "openrouter/dispute",
  });

  assert.deepEqual(env.chatModelChains.default, [
    "openrouter/default-a",
    "openrouter/default-b",
  ]);
  assert.deepEqual(env.chatModelChains.productQna, ["openrouter/product"]);
  assert.deepEqual(env.chatModelChains.disputeSummary, [
    "openrouter/dispute",
  ]);
  assert.deepEqual(env.chatModelChains.cvNormalization, [
    "openrouter/default-a",
    "openrouter/default-b",
  ]);
});

test("parses embedding capabilities from env", () => {
  const env = createEnv({
    SHIRE_MODEL_DEFAULT: "openrouter/default",
    SHIRE_EMBEDDING_MODEL_DEFAULT: "embedding/default",
    SHIRE_EMBEDDING_MODEL_MEMORY: "embedding/memory",
    SHIRE_EMBEDDING_BASE_URL_DEFAULT: "https://example.test/v1/",
    SHIRE_EMBEDDING_BASE_URL_PRODUCT_KNOWLEDGE: "https://product.test/v1/",
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
    SHIRE_MODEL_DISPUTE_SUMMARY: "openai/gpt-5.1",
    SHIRE_EMBEDDING_ENABLED: "true",
    SHIRE_WORKING_MEMORY_ENABLED: "true",
    SHIRE_EMBEDDING_BASE_URL_DEFAULT: "https://embedding.example/v1/",
    SHIRE_WORKER_ENABLED: "false",
    SHIRE_LIVE_LLM_TESTS: "true",
    REDIS_URL: "rediss://redis.example:6379",
    SHIRE_AGENT_SERVICE_TOKEN: "secret",
    SHIRE_JOB_QUEUE_NAME: "custom-jobs",
    SHIRE_JOB_ATTEMPTS: "4",
    SHIRE_JOB_BACKOFF_MS: "7000",
    SHIRE_CV_MAX_FILE_BYTES: "6000000",
  });

  assert.equal(env.logLevel, "warn");
  assert.equal(env.prettyLogs, false);
  assert.deepEqual(env.chatModelChains.disputeSummary, ["openai/gpt-5.1"]);
  assert.equal(env.embeddingEnabled, true);
  assert.equal(env.workingMemoryEnabled, true);
  assert.equal(env.embeddingBaseUrls.default, "https://embedding.example/v1");
  assert.equal(env.workerEnabled, false);
  assert.equal(env.liveLlmTestsEnabled, true);
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

test("rejects invalid security threshold and guard mode config", () => {
  assert.throws(() => createEnv({ SHIRE_SECURITY_GUARD_THRESHOLD: "-0.01" }));
  assert.throws(() => createEnv({ SHIRE_SECURITY_GUARD_THRESHOLD: "1.01" }));
  assert.throws(() => createEnv({ SHIRE_SECURITY_GUARD_MODE: "wide-open" }));
});
