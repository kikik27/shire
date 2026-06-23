import assert from "node:assert/strict";
import test from "node:test";

import {
  cvProfileAgent,
  disputeSummaryAgent,
  jobMatchingAgent,
  mastra,
  parseCvWorkflow,
  parseCvWorkflowId,
  jobMatchingWorkflow,
  jobMatchingWorkflowId,
  talentMatchingWorkflow,
  talentMatchingWorkflowId,
  disputeSummaryWorkflow,
  disputeSummaryWorkflowId,
  userContextTool,
  candidateContextTool,
  companyContextTool,
  jobContextTool,
  matchingContextTool,
  evidenceContextTool,
} from "../src/mastra";
import { getRuntimeBootstrapOutput } from "../src/server";
import { jobRegistry } from "../src/runtime/server/job-registry";
import { getStorageDiagnostics } from "../src/runtime/storage/diagnostics";

test("mastra registry exports the expected agents, workflows, and tools", () => {
  assert.ok(mastra);

  assert.equal(cvProfileAgent.id, "cv-profile-agent");
  assert.equal(jobMatchingAgent.id, "job-matching-agent");
  assert.equal(disputeSummaryAgent.id, "dispute-summary-agent");
  assert.equal(parseCvWorkflow.id, parseCvWorkflowId);
  assert.equal(jobMatchingWorkflow.id, jobMatchingWorkflowId);
  assert.equal(talentMatchingWorkflow.id, talentMatchingWorkflowId);
  assert.equal(disputeSummaryWorkflow.id, disputeSummaryWorkflowId);

  assert.equal(userContextTool.id, "user-context-tool");
  assert.equal(candidateContextTool.id, "candidate-context-tool");
  assert.equal(companyContextTool.id, "company-context-tool");
  assert.equal(jobContextTool.id, "job-context-tool");
  assert.equal(matchingContextTool.id, "matching-context-tool");
  assert.equal(evidenceContextTool.id, "evidence-context-tool");
});

test("runtime bootstrap output mirrors the job registry", () => {
  const bootstrap = getRuntimeBootstrapOutput();

  assert.deepEqual(bootstrap.jobs, Object.keys(jobRegistry));
  assert.equal(bootstrap.status, "runtime-ready");
  assert.deepEqual(Object.keys(bootstrap.storage), [
    "memory",
    "knowledge",
    "knowledgeManifest",
  ]);
  assert.equal(JSON.stringify(bootstrap).includes("turso"), false);
});

test("storage diagnostics expose persistence shape without urls or tokens", () => {
  const diagnostics = getStorageDiagnostics({
    agentMemoryUrl: "libsql://shire-agent-memory-labsmula.aws-ap-northeast-1.turso.io",
    agentMemoryAuthToken: "secret-memory-token",
    agentKnowledgeUrl: "file:./.data/shire-agent-knowledge.db",
    agentKnowledgeAuthToken: undefined,
    agentKnowledgeManifestUrl: "libsql://shire-agent-manifest.example.turso.io",
    agentKnowledgeManifestAuthToken: "secret-manifest-token",
  });

  assert.deepEqual(diagnostics, {
    memory: {
      scheme: "libsql",
      persistent: true,
      authConfigured: true,
    },
    knowledge: {
      scheme: "file",
      persistent: false,
      authConfigured: false,
    },
    knowledgeManifest: {
      scheme: "libsql",
      persistent: true,
      authConfigured: true,
    },
  });
  assert.equal(JSON.stringify(diagnostics).includes("secret"), false);
  assert.equal(JSON.stringify(diagnostics).includes("turso"), false);
});
