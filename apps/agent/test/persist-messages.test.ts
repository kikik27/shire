import assert from "node:assert/strict";
import test from "node:test";

import { persistChatTurn } from "../src/runtime/chat/persist-messages";

/**
 * Minimal fake of the Mastra LibSQL memory substore. Captures the calls so we
 * can assert the workaround writes the thread + message records that Mastra's
 * agent.stream()/generate() path fails to persist.
 */
type StoredMessage = {
  id: string;
  threadId: string;
  resourceId: string;
  role: string;
  type: string;
  content: unknown;
  createdAt: Date;
};

function createFakeMemoryStore(shouldFail = false) {
  const calls: { saveThread: unknown[]; saveMessages: unknown[] } = {
    saveThread: [],
    saveMessages: [],
  };
  const messages: StoredMessage[] = [];
  return {
    calls,
    messages,
    async saveThread({ thread }: { thread: Record<string, unknown> }) {
      if (shouldFail) throw new Error("store unavailable");
      calls.saveThread.push(thread);
    },
    async saveMessages({ messages: msgs }: { messages: StoredMessage[] }) {
      if (shouldFail) throw new Error("store unavailable");
      calls.saveMessages.push(msgs);
      messages.push(...msgs);
    },
  };
}

test("persistChatTurn writes a thread and exactly two messages (user + assistant)", async () => {
  const store = createFakeMemoryStore();

  await persistChatTurn({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    memoryStore: store as any,
    thread: "user:42:role:candidate:job:job_1",
    resource: "user:42:role:candidate",
    userMessages: [
      { role: "user", content: "ignored earlier turn" },
      { role: "user", content: "What is the salary for this role?" },
    ],
    assistantText: "The salary band is $80k–$100k.",
  });

  assert.equal(store.calls.saveThread.length, 1, "thread is saved once");
  const thread = store.calls.saveThread[0] as Record<string, unknown>;
  assert.equal(thread.id, "user:42:role:candidate:job:job_1");
  assert.equal(thread.resourceId, "user:42:role:candidate");

  assert.equal(store.calls.saveMessages.length, 1, "messages saved in one batch");
  const saved = store.messages;
  assert.equal(saved.length, 2, "exactly two messages (user + assistant)");

  const [userMsg, assistantMsg] = saved;
  assert.equal(userMsg.role, "user");
  assert.equal(userMsg.threadId, "user:42:role:candidate:job:job_1");
  assert.equal(userMsg.resourceId, "user:42:role:candidate");
  assert.equal(userMsg.type, "text");
  assert.equal(assistantMsg.role, "assistant");
  assert.equal(assistantMsg.threadId, "user:42:role:candidate:job:job_1");
  assert.equal(assistantMsg.resourceId, "user:42:role:candidate");
  assert.equal(assistantMsg.type, "text");
});

test("persistChatTurn uses only the last user message as the persisted user turn", async () => {
  const store = createFakeMemoryStore();

  await persistChatTurn({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    memoryStore: store as any,
    thread: "t1",
    resource: "r1",
    userMessages: [
      { role: "user", content: "earlier" },
      { role: "assistant", content: "prior answer" },
      { role: "user", content: "the latest question" },
    ],
    assistantText: "the answer",
  });

  const userMsg = store.messages.find((m) => m.role === "user");
  const content = userMsg?.content as { parts: { text: string }[] };
  assert.equal(content.parts[0].text, "the latest question");
});

test("persistChatTurn handles AI SDK parts-shaped user messages", async () => {
  const store = createFakeMemoryStore();

  await persistChatTurn({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    memoryStore: store as any,
    thread: "t-parts",
    resource: "r-parts",
    userMessages: [
      {
        id: "uim-1",
        role: "user",
        parts: [{ type: "text", text: "What is the salary?" }],
      },
    ],
    assistantText: "$90k.",
  });

  const userMsg = store.messages.find((m) => m.role === "user");
  const content = userMsg?.content as { parts: { text: string }[] };
  assert.equal(content.parts[0].text, "What is the salary?");
});

test("persistChatTurn does not throw when the store fails (fire-and-forget safe)", async () => {
  const store = createFakeMemoryStore(true);

  // Must resolve, not reject — storage failures must never break the chat path.
  await assert.doesNotReject(() =>
    persistChatTurn({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      memoryStore: store as any,
      thread: "t2",
      resource: "r2",
      userMessages: [{ role: "user", content: "hi" }],
      assistantText: "hello",
    }),
  );
});

test("persistChatTurn persists nothing when there is no user message", async () => {
  const store = createFakeMemoryStore();

  await persistChatTurn({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    memoryStore: store as any,
    thread: "t3",
    resource: "r3",
    userMessages: [{ role: "assistant", content: "only an assistant msg" }],
    assistantText: "hello",
  });

  assert.equal(store.calls.saveThread.length, 0, "no thread written");
  assert.equal(store.calls.saveMessages.length, 0, "no messages written");
});
