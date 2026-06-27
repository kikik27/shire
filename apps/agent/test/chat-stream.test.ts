import test from "node:test";
import assert from "node:assert/strict";

process.env.TOKENROUTER_API_KEY ??= "test-tokenrouter-api-key";

const { createAiSdkHiddenReasoningStreamSanitizer } = await import(
  "../src/runtime/chat/stream-sanitizer"
);

// AI SDK v6 upstream emits each event terminated by a blank line (`\n\n`).
// These helpers mirror that format so the sanitizer tests run against the
// real wire shape rather than the previous (incorrect) single-`\n` form.
function textDelta(delta: string) {
  return `data: ${JSON.stringify({ type: "text-delta", id: "txt-0", delta })}\n\n`;
}

function doneChunk() {
  return "data: [DONE]\n\n";
}

/**
 * Parse the sanitizer output as a sequence of SSE events, the same way a
 * downstream SSE consumer (browser EventSource / @assistant-ui/react-ai-sdk)
 * would. Each event must be a single `data: …` line whose payload JSON-parses
 * cleanly. The original bug concatenated adjacent `data:` lines into a single
 * payload, which is exactly what this helper guards against.
 */
function parseSseEvents(output: string) {
  const events: Array<{ payload: string; json: unknown }> = [];
  for (const block of output.split("\n\n")) {
    if (!block) continue;
    const lines = block.split("\n").filter((line) => line.startsWith("data: "));
    if (lines.length === 0) continue;
    const payload = lines.map((line) => line.slice("data: ".length)).join("\n");
    if (payload === "[DONE]") {
      events.push({ payload, json: "[DONE]" });
      continue;
    }
    events.push({ payload, json: JSON.parse(payload) });
  }
  return events;
}

test("AI SDK stream sanitizer masks hidden reasoning across chunks", () => {
  const sanitizer = createAiSdkHiddenReasoningStreamSanitizer();
  const chunks = [
    textDelta("<think>\nThe user is asking again"),
    textDelta(" and this reasoning should stay hidden."),
    textDelta("</think>\nHalo Alex! "),
    textDelta("Ini rekomendasinya."),
    doneChunk(),
  ];

  const output = chunks
    .map((chunk) => sanitizer.sanitize(chunk))
    .join("") + sanitizer.flush();

  assert.ok(!output.includes("<think>"));
  assert.ok(!output.includes("reasoning should stay hidden"));
  assert.ok(output.includes('"type":"reasoning-start"'));
  assert.ok(output.includes('"type":"reasoning-delta"'));
  assert.ok(output.includes('"type":"reasoning-end"'));
  assert.ok(output.includes("Memahami pertanyaan dan konteks percakapan"));
  assert.ok(output.includes("Halo Alex! "));
  assert.ok(output.includes("Ini rekomendasinya."));
  assert.ok(output.includes("data: [DONE]"));
});

test("AI SDK stream sanitizer emits every event with a \\n\\n terminator", () => {
  const sanitizer = createAiSdkHiddenReasoningStreamSanitizer();
  const chunks = [
    textDelta("<think>matching jobs to candidate profile"),
    textDelta("</think> Halo Alex!"),
    doneChunk(),
  ];

  const output = chunks
    .map((chunk) => sanitizer.sanitize(chunk))
    .join("") + sanitizer.flush();

  // The downstream SSE parser relies on `\n\n` (blank line) to delimit one
  // event from the next. Without it, two adjacent `data:` lines get
  // concatenated and the resulting JSON payload fails to parse — which is the
  // exact symptom of the reported bug. Splitting the output on `\n\n` and
  // asserting each non-empty block is a single `data:` line is the cleanest
  // way to lock this in: any regression that drops or replaces the blank line
  // will produce a block that contains more than one `data:` line.
  const blocks = output.split("\n\n");
  assert.ok(blocks.length >= 3, "expected at least three event blocks");

  for (const block of blocks) {
    if (!block) continue;
    const dataLines = block.split("\n").filter((line) => line.startsWith("data: "));
    assert.equal(
      dataLines.length,
      1,
      `expected exactly one data: line per event block, got ${dataLines.length} in ${JSON.stringify(block)}`,
    );
  }
});

test("AI SDK stream sanitizer output parses as a sequence of well-formed SSE events", () => {
  // Regression test for the reported failure: when one input text-delta is
  // expanded into reasoning-start + reasoning-delta + reasoning-end +
  // text-delta, the JSON.parse call downstream used to fail because the events
  // were emitted with single `\n` separators and got concatenated.
  const sanitizer = createAiSdkHiddenReasoningStreamSanitizer();
  const chunks = [
    textDelta("<think>matching jobs to candidate profile"),
    textDelta("</think> Here are your matches."),
    doneChunk(),
  ];

  const output = chunks
    .map((chunk) => sanitizer.sanitize(chunk))
    .join("") + sanitizer.flush();

  const events = parseSseEvents(output);
  const types = events.map((event) => {
    const json = event.json;
    if (json === "[DONE]") return "[DONE]";
    return (json as { type?: string }).type ?? "unknown";
  });

  assert.deepEqual(types, [
    "reasoning-start",
    "reasoning-delta",
    "reasoning-end",
    "text-delta",
    "[DONE]",
  ]);

  // The reasoning events must share an id so the browser-side assistant-ui
  // `reasoning` part handler renders them as a single running reasoning block.
  const reasoningIds = new Set<string>();
  for (const event of events) {
    const json = event.json;
    if (json === "[DONE]") continue;
    const type = (json as { type?: string }).type;
    if (type && type.startsWith("reasoning-")) {
      reasoningIds.add((json as { id: string }).id);
    }
  }
  assert.equal(reasoningIds.size, 1, "reasoning events must share a single id");
});

test("AI SDK stream sanitizer buffers partial events until \\n\\n arrives", () => {
  // Upstream may split a single event across chunks (e.g. when the model
  // emits a very long reasoning delta and the OS buffers the socket write).
  // The sanitizer must hold partial text and only emit once the event
  // terminator (`\n\n`) is seen, otherwise we would emit half-formed events
  // that downstream parsers cannot decode.
  const sanitizer = createAiSdkHiddenReasoningStreamSanitizer();
  const fullJson = JSON.stringify({
    type: "text-delta",
    id: "txt-0",
    delta: "Halo Alex!",
  });
  const splitAt = Math.floor(fullJson.length / 2);
  const halfA = `data: ${fullJson.slice(0, splitAt)}`;
  const halfB = `${fullJson.slice(splitAt)}\n\n`;
  const trailing = doneChunk();

  const outA = sanitizer.sanitize(halfA);
  assert.equal(outA, "", "partial event without terminator must not be emitted");

  const outB = sanitizer.sanitize(halfB);
  assert.ok(outB.startsWith("data: {"), "must emit the complete event after \\n\\n");
  assert.ok(outB.endsWith("\n\n"));

  const outFinal = sanitizer.sanitize(trailing) + sanitizer.flush();
  const combined = outA + outB + outFinal;
  assert.ok(combined.includes("Halo Alex!"));
  assert.ok(combined.includes("data: [DONE]"));
  assert.ok(combined.endsWith("\n\n"));
});