import assert from "node:assert/strict";
import test from "node:test";

import {
  getStorageDiagnostics,
  probeStorageReadiness,
} from "../src/runtime/storage/diagnostics";

const localRuntime = {
  agentMemoryUrl: "file:./.data/shire-agent-memory.db",
  agentMemoryAuthToken: undefined,
  agentKnowledgeUrl: "file:./.data/shire-agent-knowledge.db",
  agentKnowledgeAuthToken: undefined,
  agentKnowledgeManifestUrl: "file:./.data/shire-agent-knowledge.db",
  agentKnowledgeManifestAuthToken: undefined,
};

test("diagnostics describe local file stores as non-persistent and unauthenticated", () => {
  const diagnostics = getStorageDiagnostics(localRuntime);

  assert.deepEqual(diagnostics.memory, {
    scheme: "file",
    persistent: false,
    authConfigured: false,
  });
  assert.deepEqual(diagnostics.knowledge, {
    scheme: "file",
    persistent: false,
    authConfigured: false,
  });
});

test("local file stores are always reported ready without network I/O", async () => {
  const result = await probeStorageReadiness(localRuntime);

  assert.deepEqual(result, { ready: true });
});

test("an unreachable remote libsql store reports not ready", async () => {
  const probeCalls: Array<{ url: string; authToken?: string }> = [];
  const result = await probeStorageReadiness(
    {
      agentMemoryUrl: "libsql://memory.example.test",
      agentMemoryAuthToken: "token",
      agentKnowledgeUrl: "libsql://knowledge.example.test",
      agentKnowledgeAuthToken: "token",
      agentKnowledgeManifestUrl: "libsql://manifest.example.test",
      agentKnowledgeManifestAuthToken: "token",
    },
    {
      pingLibSql: async (url, authToken) => {
        probeCalls.push({ url, authToken });
        return false;
      },
    },
  );

  assert.equal(result.ready, false);
  assert.match(result.reason, /store unreachable/);
  assert.deepEqual(probeCalls, [
    { url: "libsql://memory.example.test", authToken: "token" },
  ]);
});
