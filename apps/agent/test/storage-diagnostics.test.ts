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
  const result = await probeStorageReadiness({
    agentMemoryUrl: "libsql://nonexistent-host.invalid:9999",
    agentMemoryAuthToken: "token",
    agentKnowledgeUrl: "libsql://nonexistent-host.invalid:9999",
    agentKnowledgeAuthToken: "token",
    agentKnowledgeManifestUrl: "libsql://nonexistent-host.invalid:9999",
    agentKnowledgeManifestAuthToken: "token",
  });

  assert.equal(result.ready, false);
  assert.match(result.reason, /store unreachable/);
});
