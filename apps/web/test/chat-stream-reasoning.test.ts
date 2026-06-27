import assert from "node:assert/strict";
import test from "node:test";

/**
 * Full-flow regression test for the streaming bug that broke the chat UI's
 * loading state.
 *
 *   agent sanitizer  →  Express response  →  Next.js transparent proxy
 *      →  browser AssistantChatTransport  →  assistant-ui Thread
 *
 * The agent-side sanitizer strips `<think>...</think>` blocks from
 * text-delta payloads and replaces them with reasoning-start / delta / end
 * events so the UI can show a "thinking" indicator. Those events must
 * reach the browser with the SSE `\n\n` event boundary; otherwise the
 * browser-side parser concatenates adjacent `data:` lines and `JSON.parse`
 * fails mid-stream — which was the reported symptom.
 *
 * This test exercises the agent sanitizer from the web app's test harness
 * (so we don't need to mock fetch / EventSource) and asserts the resulting
 * event sequence is exactly what assistant-ui's `MessagePrimitive.Parts`
 * expects when `part.type === "reasoning"` is rendered as the
 * `<ThinkingState>` loading UI in `components/assistant-ui/thread.tsx`.
 */

type ParsedSseEvent =
  | { type: "json"; payload: Record<string, unknown> }
  | { type: "done" };

function parseSseEvents(output: string): ParsedSseEvent[] {
  const events: ParsedSseEvent[] = [];
  for (const block of output.split("\n\n")) {
    if (!block) continue;
    const dataLines = block
      .split("\n")
      .filter((line) => line.startsWith("data: "));
    if (dataLines.length === 0) continue;
    if (dataLines.length > 1) {
      // Adjacent `data:` lines with no `\n\n` between them — this is the
      // exact shape the reported bug produced. A well-formed stream must
      // never yield a block with more than one `data:` line.
      throw new Error(
        `SSE block has ${dataLines.length} data: lines, expected 1. Block: ${JSON.stringify(block)}`,
      );
    }
    const payload = dataLines[0].slice("data: ".length);
    if (payload === "[DONE]") {
      events.push({ type: "done" });
      continue;
    }
    events.push({ type: "json", payload: JSON.parse(payload) });
  }
  return events;
}

async function loadSanitizer() {
  const url = new URL(
    "../../agent/src/runtime/chat/stream-sanitizer.ts",
    import.meta.url,
  );
  const mod = await import(url.href);
  return mod.createAiSdkHiddenReasoningStreamSanitizer as () => {
    sanitize: (chunk: unknown) => unknown;
    flush: () => string;
  };
}

async function buildAgentStream(
  chunks: string[],
): Promise<{ stream: string; events: ParsedSseEvent[] }> {
  const createSanitizer = await loadSanitizer();
  const sanitizer = createSanitizer();
  let output = "";
  for (const chunk of chunks) {
    const sanitized = sanitizer.sanitize(chunk);
    if (typeof sanitized === "string" && sanitized) {
      output += sanitized;
    }
  }
  output += sanitizer.flush();
  return { stream: output, events: parseSseEvents(output) };
}

function textDeltaEvent(delta: string, id = "txt-0") {
  return `data: ${JSON.stringify({ type: "text-delta", id, delta })}\n\n`;
}

test("hidden-reasoning stream produces a reasoning block the UI can render", async () => {
  // The model emits a `<think>…` block followed by the user-visible answer.
  // The sanitizer expands this into a reasoning sequence (start / delta /
  // end) plus a cleaned text-delta. The assistant-ui Thread component's
  // `MessagePrimitive.Parts` callback renders reasoning parts as
  // `<ThinkingState>` (see `components/assistant-ui/thread.tsx`), so this
  // event sequence is what unlocks the loading state in the UI.
  const { events } = await buildAgentStream([
    textDeltaEvent("<think>matching jobs to candidate profile"),
    textDeltaEvent("</think> Here are your matches."),
    "data: [DONE]\n\n",
  ]);

  const types = events.map((event) =>
    event.type === "done" ? "[DONE]" : (event.payload.type as string),
  );
  assert.deepEqual(types, [
    "reasoning-start",
    "reasoning-delta",
    "reasoning-end",
    "text-delta",
    "[DONE]",
  ]);

  // The reasoning events must share a single id so assistant-ui groups them
  // into one running `reasoning` part instead of three separate parts.
  const reasoningIds = new Set<string>();
  for (const event of events) {
    if (event.type !== "json") continue;
    const t = event.payload.type;
    if (typeof t === "string" && t.startsWith("reasoning-")) {
      reasoningIds.add(event.payload.id as string);
    }
  }
  assert.equal(reasoningIds.size, 1, "reasoning events must share a single id");

  // The visible text-delta must NOT contain the hidden reasoning string.
  // `thread.tsx` calls `stripHiddenReasoning` defensively on text parts,
  // but the sanitizer is the primary defense.
  const textDelta = events.find(
    (event): event is Extract<ParsedSseEvent, { type: "json" }> =>
      event.type === "json" && event.payload.type === "text-delta",
  );
  assert.ok(textDelta, "expected a text-delta event");
  assert.equal(textDelta.payload.delta, " Here are your matches.");
  assert.ok(
    !String(textDelta.payload.delta).includes("matching jobs to candidate profile"),
    "text-delta must not leak hidden reasoning",
  );
});

test("pass-through stream preserves original event sequence for the UI", async () => {
  // When the model does NOT emit hidden reasoning, the sanitizer must be
  // a pure pass-through (modulo the SSE terminator). The UI's
  // `MessagePrimitive.Parts` callback expects to see the raw event types
  // the AI SDK upstream produced.
  const { events } = await buildAgentStream([
    `data: ${JSON.stringify({ type: "start", messageId: "msg-1" })}\n\n`,
    `data: ${JSON.stringify({ type: "start-step" })}\n\n`,
    `data: ${JSON.stringify({ type: "text-start", id: "txt-0" })}\n\n`,
    textDeltaEvent("Halo Alex!"),
    `data: ${JSON.stringify({ type: "text-end", id: "txt-0" })}\n\n`,
    `data: ${JSON.stringify({ type: "finish-step" })}\n\n`,
    `data: ${JSON.stringify({ type: "finish" })}\n\n`,
    "data: [DONE]\n\n",
  ]);

  const types = events.map((event) =>
    event.type === "done" ? "[DONE]" : (event.payload.type as string),
  );
  assert.deepEqual(types, [
    "start",
    "start-step",
    "text-start",
    "text-delta",
    "text-end",
    "finish-step",
    "finish",
    "[DONE]",
  ]);
});

test("stream surfaces an Indonesian status string the loading UI can show", async () => {
  // The sanitizer maps hidden-reasoning keywords to short Indonesian
  // status messages (e.g. "Menimbang rekomendasi dan batas data
  // lowongan…"). The UI rotates through these in `<AITextLoading>` while
  // the reasoning part is in `running` state. This test pins that
  // mapping so the loading-state copy is not silently dropped by a
  // future sanitizer refactor.
  const { events } = await buildAgentStream([
    textDeltaEvent("<think>matching jobs to candidate profile"),
    textDeltaEvent("</think>"),
    "data: [DONE]\n\n",
  ]);

  const reasoningDelta = events.find(
    (event): event is Extract<ParsedSseEvent, { type: "json" }> =>
      event.type === "json" && event.payload.type === "reasoning-delta",
  );
  assert.ok(reasoningDelta, "expected a reasoning-delta event");
  assert.equal(
    reasoningDelta.payload.delta,
    "Mencocokkan pertanyaan dengan konteks profil dan role aktif...",
  );
});