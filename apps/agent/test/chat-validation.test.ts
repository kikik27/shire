import assert from "node:assert/strict";
import test from "node:test";

import { validateChatRequest } from "../src/runtime/chat/validation";

const OPTIONS = {
  maxBodyBytes: 65_536,
  maxMessages: 50,
  maxMessageCharacters: 8_000,
};

test("rejects non-object body", () => {
  const result = validateChatRequest(null, OPTIONS);
  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "invalid-body");
});

test("rejects body without messages key", () => {
  const result = validateChatRequest({}, OPTIONS);
  // Missing messages key means invalid body structure
  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "invalid-body");
});

test("rejects body without messages array", () => {
  const result = validateChatRequest({ messages: "not-array" }, OPTIONS);
  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "invalid-body");
});

test("rejects empty messages array", () => {
  const result = validateChatRequest({ messages: [] }, OPTIONS);
  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "missing-user-message");
});

test("validates body within size limits", () => {
  const body = {
    messages: [{ role: "user", content: "hello" }],
    scope: {
      viewerId: "candidate-001",
      role: "candidate",
      resourceType: "job",
      resourceId: "job_001",
    },
  };
  const result = validateChatRequest(body, OPTIONS);
  assert.equal(result.valid, true);
  assert.equal(result.latestUserText, "hello");
  assert.equal(result.messageCount, 1);
  assert.ok(result.bodyBytes > 0);
});

test("validates body with parts array", () => {
  const body = {
    messages: [
      {
        role: "user",
        parts: [{ type: "text", text: "hello from parts" }],
      },
    ],
  };
  const result = validateChatRequest(body, OPTIONS);
  assert.equal(result.valid, true);
  assert.equal(result.latestUserText, "hello from parts");
});

test("rejects body too large", () => {
  const body = {
    messages: [{ role: "user", content: "x".repeat(70_000) }],
  };
  const result = validateChatRequest(body, { ...OPTIONS, maxBodyBytes: 10_000 });
  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "body-too-large");
});

test("rejects too many messages", () => {
  const messages = Array.from({ length: 51 }, (_, i) => ({
    role: "user",
    content: `message ${i}`,
  }));
  const result = validateChatRequest({ messages }, OPTIONS);
  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "too-many-messages");
});

test("rejects message too long", () => {
  const body = {
    messages: [{ role: "user", content: "x".repeat(9_000) }],
  };
  const result = validateChatRequest(body, OPTIONS);
  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "message-too-long");
});

test("validates unknown-language text as valid", () => {
  const body = {
    messages: [{ role: "user", content: "こんにちは世界" }],
  };
  const result = validateChatRequest(body, OPTIONS);
  assert.equal(result.valid, true);
  assert.equal(result.latestUserText, "こんにちは世界");
});

test("validates Indonesian text as valid", () => {
  const body = {
    messages: [{ role: "user", content: "Apa itu Shire?" }],
  };
  const result = validateChatRequest(body, OPTIONS);
  assert.equal(result.valid, true);
  assert.equal(result.latestUserText, "Apa itu Shire?");
});

test("validates Arabic text as valid", () => {
  const body = {
    messages: [{ role: "user", content: "ما هو شاير؟" }],
  };
  const result = validateChatRequest(body, OPTIONS);
  assert.equal(result.valid, true);
  assert.equal(result.latestUserText, "ما هو شاير؟");
});

test("rejects invalid scope when present", () => {
  const body = {
    messages: [{ role: "user", content: "hello" }],
    scope: {
      viewerId: "candidate-001",
      // Missing required fields
    },
  };
  const result = validateChatRequest(body, OPTIONS);
  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "invalid-scope");
});

test("rejects missing viewerId in scope", () => {
  const body = {
    messages: [{ role: "user", content: "hello" }],
    scope: {
      role: "candidate",
      resourceType: "job",
      resourceId: "job_001",
    },
  };
  const result = validateChatRequest(body, OPTIONS);
  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "invalid-scope");
});

test("validates scope with all required fields", () => {
  const body = {
    messages: [{ role: "user", content: "hello" }],
    scope: {
      viewerId: "candidate-001",
      role: "candidate",
      resourceType: "job",
      resourceId: "job_001",
    },
  };
  const result = validateChatRequest(body, OPTIONS);
  assert.equal(result.valid, true);
});

test("rejects unsupported scope role", () => {
  const body = {
    messages: [{ role: "user", content: "hello" }],
    scope: {
      viewerId: "candidate-001",
      role: "admin",
    },
  };
  const result = validateChatRequest(body, OPTIONS);
  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "invalid-scope");
});

test("ignores scope when not an object", () => {
  const body = {
    messages: [{ role: "user", content: "hello" }],
    scope: "not-an-object",
  };
  const result = validateChatRequest(body, OPTIONS);
  assert.equal(result.valid, true);
});

test("rejects empty message content", () => {
  const body = {
    messages: [{ role: "user", content: "" }],
  };
  const result = validateChatRequest(body, OPTIONS);
  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "missing-user-message");
});

test("extracts latest user message from multiple messages", () => {
  const body = {
    messages: [
      { role: "user", content: "first message" },
      { role: "assistant", content: "response" },
      { role: "user", content: "latest message" },
    ],
  };
  const result = validateChatRequest(body, OPTIONS);
  assert.equal(result.valid, true);
  assert.equal(result.latestUserText, "latest message");
});

test("validates Indonesian unrelated topic as valid (no blocking)", () => {
  const body = {
    messages: [{ role: "user", content: "Resep masakan apa yang enak?" }],
  };
  const result = validateChatRequest(body, OPTIONS);
  assert.equal(result.valid, true);
  assert.equal(result.latestUserText, "Resep masakan apa yang enak?");
});

test("validates Japanese unrelated topic as valid (no blocking)", () => {
  const body = {
    messages: [{ role: "user", content: "天気はどうですか？" }],
  };
  const result = validateChatRequest(body, OPTIONS);
  assert.equal(result.valid, true);
  assert.equal(result.latestUserText, "天気はどうですか？");
});

test("validates Spanish unrelated topic as valid (no blocking)", () => {
  const body = {
    messages: [{ role: "user", content: "¿Qué tiempo hace hoy?" }],
  };
  const result = validateChatRequest(body, OPTIONS);
  assert.equal(result.valid, true);
  assert.equal(result.latestUserText, "¿Qué tiempo hace hoy?");
});
