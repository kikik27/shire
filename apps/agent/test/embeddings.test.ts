import assert from "node:assert/strict";
import test from "node:test";

process.env.OPENROUTER_API_KEY ??= "test-openrouter-api-key";

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

test("creates Qwen embeddings through OpenRouter", () => {
  const model = createEmbeddingModel({
    modelId: "qwen/qwen3-embedding-8b",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "test-openrouter-api-key",
  });

  assert.equal(model.provider, "openrouter");
  assert.equal(model.modelId, "qwen/qwen3-embedding-8b");
  assert.equal(typeof model.doEmbed, "function");
});

test("resolves embedding config for a specific capability", () => {
  const runtime = createEnv({
    SHIRE_MODEL_DEFAULT: "openrouter/default",
    SHIRE_EMBEDDING_MODEL_DEFAULT: "embedding/default",
    SHIRE_EMBEDDING_MODEL_MEMORY: "embedding/memory",
    SHIRE_EMBEDDING_BASE_URL_DEFAULT: "https://default.test/v1",
    SHIRE_EMBEDDING_BASE_URL_MEMORY: "https://memory.test/v1",
  } as NodeJS.ProcessEnv);

  assert.deepEqual(resolveEmbeddingConfig("memory", runtime), {
    modelId: "embedding/memory",
    baseUrl: "https://memory.test/v1",
  });
  assert.deepEqual(resolveEmbeddingConfig("product-knowledge", runtime), {
    modelId: "embedding/default",
    baseUrl: "https://default.test/v1",
  });
});
