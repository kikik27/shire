import assert from "node:assert/strict";
import test from "node:test";

process.env.SHIRE_EMBEDDING_API_KEY ??= "test-openai-api-key";
process.env.SHIRE_TEXT_API_KEY ??= "test-tokenrouter-api-key";

const {
  chatRouteVersion,
  mastra,
  productQnaInstructions,
  roleAwareChatAgent,
  roleAwareChatInstructions,
} = await import("../src/mastra");

test("exports the role-aware chat agent", () => {
  assert.equal(roleAwareChatAgent.id, "role-aware-chat-agent");
  assert.equal(roleAwareChatAgent.name, "Role-Aware Chat Agent");
});

test("role-aware chat does not expose tools to the configured text model", async () => {
  assert.deepEqual(await roleAwareChatAgent.listTools(), {});
});

test("loads the Mastra registry with the chat route registration", () => {
  assert.ok(mastra);
  assert.equal(mastra.listGateways()?.zai, undefined);
});

test("uses the AI SDK v6 chat protocol required by Assistant UI", () => {
  assert.equal(chatRouteVersion, "v6");
});

test("role-aware chat instructions enforce scoped security boundaries", () => {
  assert.match(roleAwareChatInstructions, /untrusted data/i);
  assert.match(roleAwareChatInstructions, /never reveal/i);
  assert.match(roleAwareChatInstructions, /authorized scope/i);
  assert.match(roleAwareChatInstructions, /Shire-related/i);
  assert.match(roleAwareChatInstructions, /brief social pleasantries/i);
  assert.match(roleAwareChatInstructions, /primary source/i);
  assert.match(roleAwareChatInstructions, /product knowledge/i);
  assert.match(roleAwareChatInstructions, /<think>/i);
  assert.match(roleAwareChatInstructions, /final user-facing answer/i);
  assert.match(roleAwareChatInstructions, /never infer access/i);
  assert.match(roleAwareChatInstructions, /fees, stake amounts, deadlines/i);
  assert.match(roleAwareChatInstructions, /information is unavailable/i);
  assert.match(roleAwareChatInstructions, /English by default/i);
  assert.match(roleAwareChatInstructions, /Do not use em dashes/i);
  assert.match(roleAwareChatInstructions, /scratchpad text/i);
  assert.match(roleAwareChatInstructions, /reasoning preambles/i);
  assert.doesNotMatch(roleAwareChatInstructions, new RegExp("\\u2014"));
});

test("product Q&A instructions avoid hidden reasoning and em dashes", () => {
  assert.match(productQnaInstructions, /<think>/i);
  assert.match(productQnaInstructions, /final user-facing answer/i);
  assert.match(productQnaInstructions, /Do not use em dashes/i);
  assert.match(productQnaInstructions, /scratchpad text/i);
  assert.match(productQnaInstructions, /reasoning preambles/i);
  assert.doesNotMatch(productQnaInstructions, new RegExp("\\u2014"));
});
