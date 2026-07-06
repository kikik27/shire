import assert from "node:assert/strict";
import test from "node:test";

import { Memory } from "@mastra/memory";
import { LibSQLStore, LibSQLVector } from "@mastra/libsql";

process.env.SHIRE_EMBEDDING_API_KEY ??= "test-openai-api-key";

const [{ createEnv }, memoryModule] = await Promise.all([
  import("../src/env"),
  import("../src/runtime/memory"),
]);
const { buildLibSQLRuntimeConfig } = await import("../src/runtime/storage/libsql-config");

const {
  agentMemory,
  agentMemoryTemplate,
  buildAgentMemoryConfig,
  createAgentMemory,
  createAgentMemoryConfig,
} = memoryModule;

const runtime = {
  ...createEnv({}),
  agentMemoryUrl: "file:./.data/test-agent-memory.db",
  agentKnowledgeUrl: "file:./.data/test-agent-knowledge.db",
};

test("libsql runtime config includes auth token only when configured", () => {
  assert.deepEqual(
    buildLibSQLRuntimeConfig({
      id: "memory",
      url: "libsql://shire-agent-memory-labsmula.aws-ap-northeast-1.turso.io",
      authToken: " turso-token ",
    }),
    {
      id: "memory",
      url: "libsql://shire-agent-memory-labsmula.aws-ap-northeast-1.turso.io",
      authToken: "turso-token",
    },
  );

  assert.deepEqual(
    buildLibSQLRuntimeConfig({
      id: "memory",
      url: "file:./.data/test-agent-memory.db",
    }),
    {
      id: "memory",
      url: "file:./.data/test-agent-memory.db",
    },
  );
});

test("agent memory config includes vector recall and working memory", () => {
  const config = buildAgentMemoryConfig({
    ...runtime,
    embeddingEnabled: true,
    workingMemoryEnabled: true,
  });

  assert.ok(config.storage instanceof LibSQLStore);
  assert.ok(config.vector instanceof LibSQLVector);
  assert.equal(config.options.lastMessages, 20);
  assert.deepEqual(config.options.semanticRecall, {
    topK: 5,
    messageRange: {
      before: 2,
      after: 1,
    },
    scope: "resource",
  });

  assert.equal(config.options.workingMemory.enabled, true);
  assert.equal(config.options.workingMemory.scope, "resource");
  assert.equal(config.options.workingMemory.template, agentMemoryTemplate);
  assert.equal(config.options.generateTitle, false);
  assert.equal(typeof config.embedder, "object");
  assert.equal(typeof config.embedder.doEmbed, "function");
  assert.equal(config.embedder.provider, "openai");
  assert.equal(config.embedder.modelId, "text-embedding-3-small");

  const aliasConfig = createAgentMemoryConfig({
    ...runtime,
    embeddingEnabled: true,
    workingMemoryEnabled: true,
  });
  assert.ok(aliasConfig.storage instanceof LibSQLStore);
  assert.ok(aliasConfig.vector instanceof LibSQLVector);
  assert.equal(aliasConfig.options.generateTitle, config.options.generateTitle);
  assert.equal(aliasConfig.embedder.provider, "openai");
  assert.equal(aliasConfig.embedder.modelId, "text-embedding-3-small");
});

test("agent memory skips semantic recall when embeddings are disabled", () => {
  const config = buildAgentMemoryConfig({
    ...runtime,
    embeddingEnabled: false,
  });

  assert.equal("vector" in config, false);
  assert.equal("embedder" in config, false);
  assert.equal(config.options.semanticRecall, false);
  assert.equal(config.options.workingMemory, false);
});

test("agent memory factory returns a Memory instance", () => {
  const memory = createAgentMemory(runtime);

  assert.ok(memory instanceof Memory);
});

test("shared agent memory is created from the default runtime", () => {
  assert.ok(agentMemory instanceof Memory);
});
