import assert from "node:assert/strict";
import test from "node:test";

import { runAgentWithContext } from "../src/runtime/server/agent-runner";

test("forwards bounded knowledge, memory ids, and model capability context", async () => {
  const calls: unknown[] = [];
  const agent = {
    generate: async (messages: unknown, options: unknown) => {
      calls.push({ messages, options });
      return {
        text: "ok",
        usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
      };
    },
  };

  const result = await runAgentWithContext({
    agent,
    capability: "knowledge-synthesis",
    threadId: "thread-1",
    resourceId: "user-1",
    query: "matching rules",
    messages: [{ role: "user", content: "Explain matching." }],
    search: async () => [
      { path: "rules.md", text: "Use hard filters." },
    ],
  });

  const call = calls[0] as {
    messages: Array<{ role: string; content: string }>;
    options: {
      memory: { thread: string; resource: string };
      requestContext: { get: (key: string) => unknown };
      maxOutputTokens: number;
    };
  };

  assert.equal(call.options.memory.thread, "thread-1");
  assert.equal(call.options.memory.resource, "user-1");
  assert.equal(
    call.options.requestContext.get("model-capability"),
    "knowledge-synthesis",
  );
  assert.match(call.messages[0].content, /Use hard filters/);
  assert.equal(result.usage.totalTokens, 12);
});
