import test from "node:test";
import assert from "node:assert/strict";

process.env.TOKENROUTER_API_KEY ??= "test-tokenrouter-api-key";

const { createAiSdkHiddenReasoningStreamSanitizer } = await import(
  "../src/routes/chat.middleware"
);

function textDelta(delta: string) {
  return `data: ${JSON.stringify({ type: "text-delta", id: "txt-0", delta })}\n`;
}

test("AI SDK stream sanitizer masks hidden reasoning across chunks", () => {
  const sanitizer = createAiSdkHiddenReasoningStreamSanitizer();
  const chunks = [
    textDelta("<think>\nThe user is asking again"),
    textDelta(" and this reasoning should stay hidden."),
    textDelta("</think>\nHalo Alex! "),
    textDelta("Ini rekomendasinya."),
    "data: [DONE]\n",
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
