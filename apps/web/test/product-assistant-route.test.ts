import assert from "node:assert/strict";
import test from "node:test";

import { createProductAssistantPost } from "../app/api/product-assistant/route";
import { parseUiMessageSse } from "../lib/chat/reasoning";

test("product assistant parses fragmented status and text events", () => {
  const first = parseUiMessageSse(
    "",
    'data: {"type":"data-status","data":{"status":"Checking product context"}}\n\ndata: {"type":"text-delta","delta":"Hel',
  );
  const second = parseUiMessageSse(
    first.buffer,
    'lo"}\n\ndata: [DONE]\n\n',
  );

  assert.deepEqual(first.events, [
    { type: "status", status: "Checking product context" },
  ]);
  assert.deepEqual(second.events, [
    { type: "text", delta: "Hello" },
    { type: "finish" },
  ]);
  assert.equal(second.buffer, "");
});

test("product assistant forwards the upstream stream without buffering", async () => {
  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  const handler = createProductAssistantPost({
    agentUrl: "http://agent.local/product-qna",
    serviceToken: "service-token",
    fetch: async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            streamController = controller;
            controller.enqueue(
              encoder.encode(
                'data: {"type":"data-status","data":{"status":"Checking"}}\n\n',
              ),
            );
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      ),
  });

  const response = await Promise.race([
    handler(
      new Request("http://localhost/api/product-assistant", {
        method: "POST",
        body: JSON.stringify({ question: "How does Shire staking work?" }),
      }),
    ),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("handler buffered the stream")), 100),
    ),
  ]);
  const first = await response.body?.getReader().read();

  assert.equal(response.headers.get("content-type"), "text/event-stream");
  assert.match(new TextDecoder().decode(first?.value), /data-status/);
  streamController?.close();
});

test("product assistant forwards request cancellation upstream", async () => {
  let upstreamSignal: AbortSignal | undefined;
  const handler = createProductAssistantPost({
    agentUrl: "http://agent.local/product-qna",
    serviceToken: "service-token",
    fetch: async (_url, init) => {
      upstreamSignal = init?.signal ?? undefined;
      return new Response("data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  const controller = new AbortController();
  controller.abort();

  await handler(
    new Request("http://localhost/api/product-assistant", {
      method: "POST",
      body: JSON.stringify({ question: "How does Shire work?" }),
      signal: controller.signal,
    }),
  );

  assert.equal(upstreamSignal?.aborted, true);
});
