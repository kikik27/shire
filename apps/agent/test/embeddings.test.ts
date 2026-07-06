import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

process.env.SHIRE_EMBEDDING_API_KEY ??= "test-openai-api-key";

const { createEnv } = await import("../src/env");
const {
  createEmbeddingModel,
  resolveEmbeddingConfig,
} = await import("../src/runtime/models/embeddings");

test("does not read provider-specific embedding credentials", async () => {
  const source = await readFile(
    new URL("../src/runtime/models/embeddings.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(
    source,
    /process\.env\.(?:TOKENROUTER|OPENROUTER)_API_KEY/,
  );
});

test("disables known AI SDK compatibility warning logs", () => {
  assert.equal(
    (globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS,
    false,
  );
});

test("creates OpenAI-compatible embeddings through the configured provider", () => {
  const model = createEmbeddingModel({
    modelId: "text-embedding-3-small",
    providerId: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "test-openai-api-key",
  });

  assert.equal(model.provider, "openai");
  assert.equal(model.modelId, "text-embedding-3-small");
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
