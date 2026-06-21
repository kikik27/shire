import assert from "node:assert/strict";
import test from "node:test";

process.env.TOKENROUTER_API_KEY ??= "test-tokenrouter-api-key";

const { createEnv } = await import("../src/env");
const {
  createEmbeddingModel,
  resolveEmbeddingConfig,
} = await import("../src/runtime/embeddings");

test("disables known AI SDK compatibility warning logs", () => {
  assert.equal(
    (globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS,
    false,
  );
});

test("creates Qwen embeddings through TokenRouter", () => {
  const model = createEmbeddingModel({
    modelId: "qwen/qwen3-embedding-8b",
    providerId: "tokenrouter",
    baseUrl: "https://api.tokenrouter.com/v1",
    apiKey: "test-tokenrouter-api-key",
  });

  assert.equal(model.provider, "tokenrouter");
  assert.equal(model.modelId, "qwen/qwen3-embedding-8b");
  assert.equal(typeof model.doEmbed, "function");
});

test("resolves embedding config for a specific capability", () => {
  const runtime = createEnv({
    SHIRE_TEXT_MODEL: "MiniMax-M3",
    SHIRE_EMBEDDING_MODEL: "embedding/default",
    SHIRE_EMBEDDING_MODEL_MEMORY: "embedding/memory",
    SHIRE_EMBEDDING_PROVIDER: "custom-embedding",
    SHIRE_EMBEDDING_BASE_URL: "https://default.test/v1",
    SHIRE_EMBEDDING_BASE_URL_MEMORY: "https://memory.test/v1",
    SHIRE_EMBEDDING_API_KEY: "embedding-key",
  } as NodeJS.ProcessEnv);

  assert.deepEqual(resolveEmbeddingConfig("memory", runtime), {
    modelId: "embedding/memory",
    providerId: "custom-embedding",
    baseUrl: "https://memory.test/v1",
    apiKey: "embedding-key",
  });
  assert.deepEqual(resolveEmbeddingConfig("product-knowledge", runtime), {
    modelId: "embedding/default",
    providerId: "custom-embedding",
    baseUrl: "https://default.test/v1",
    apiKey: "embedding-key",
  });
});
