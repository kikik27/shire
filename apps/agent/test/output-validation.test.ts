import assert from "node:assert/strict";
import test from "node:test";

import { validateOutputText } from "../src/runtime/security/output-validation";

test("allows normal Shire responses", () => {
  const result = validateOutputText(
    "You can create a job post from the Jobs page.",
    { maxCharacters: 200 },
  );

  assert.deepEqual(result, { safe: true });
});

test("blocks overly long output", () => {
  const result = validateOutputText("x".repeat(201), { maxCharacters: 200 });

  assert.equal(result.safe, false);
  if (!result.safe) {
    assert.equal(result.reasonCode, "output-too-long");
  }
});

test("blocks system prompt disclosure", () => {
  const result = validateOutputText(
    "Here is my system prompt and hidden instruction list.",
    { maxCharacters: 200 },
  );

  assert.equal(result.safe, false);
  if (!result.safe) {
    assert.equal(result.reasonCode, "system-prompt-leak");
  }
});

test("blocks credential-like leakage", () => {
  const result = validateOutputText(
    "The API key is sk-1234567890abcdef1234567890abcdef.",
    { maxCharacters: 200 },
  );

  assert.equal(result.safe, false);
  if (!result.safe) {
    assert.equal(result.reasonCode, "credential-leak");
  }
});

test("blocks unauthorized action claims", () => {
  const result = validateOutputText(
    "I accessed another candidate's private profile and sent the details.",
    { maxCharacters: 200 },
  );

  assert.equal(result.safe, false);
  if (!result.safe) {
    assert.equal(result.reasonCode, "unauthorized-action-claim");
  }
});
