import assert from "node:assert/strict";
import test from "node:test";

import { evaluateSecurityPolicy } from "../src/runtime/security/policy";

test("blocks high-risk prompt injection", () => {
  assert.deepEqual(
    evaluateSecurityPolicy({
      risk: "high",
      confidence: 0.98,
      category: "prompt-injection",
    }),
    { decision: "block", reasonCode: "block:prompt-injection" },
  );
});

test("degrades suspicious obfuscation", () => {
  assert.deepEqual(
    evaluateSecurityPolicy({
      risk: "medium",
      confidence: 0.72,
      category: "obfuscation",
    }),
    { decision: "degraded", reasonCode: "degraded:obfuscation" },
  );
});

test("allows low-risk and unavailable guard results", () => {
  assert.deepEqual(evaluateSecurityPolicy(null), {
    decision: "allow",
    reasonCode: "guard-unavailable",
  });

  assert.deepEqual(
    evaluateSecurityPolicy({
      risk: "low",
      confidence: 0.2,
      category: "none",
    }),
    { decision: "allow", reasonCode: "allow" },
  );
});
