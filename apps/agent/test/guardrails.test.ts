import assert from "node:assert/strict";
import test from "node:test";

import { evaluateGuardrail } from "../src/runtime/security/guardrails";

test("manual autonomy escalates clear actions", () => {
  const result = evaluateGuardrail({
    action: "send an external email",
    autonomyMode: "manual",
    ambiguous: false,
    risk: "low",
  });

  assert.deepEqual(result, {
    decision: "escalate",
    reason: "Manual mode requires approval before send an external email.",
  });
});

test("semi-autonomous mode escalates medium-risk actions", () => {
  const result = evaluateGuardrail({
    action: "delete a draft record",
    autonomyMode: "semi-autonomous",
    ambiguous: false,
    risk: "medium",
  });

  assert.equal(result.decision, "escalate");
  assert.match(result.reason, /semi-autonomous/);
});

test("fully autonomous mode proceeds with medium-risk clear actions", () => {
  const result = evaluateGuardrail({
    action: "update a cached summary",
    autonomyMode: "fully-autonomous",
    ambiguous: false,
    risk: "medium",
  });

  assert.deepEqual(result, {
    decision: "proceed",
    reason: "Action update a cached summary can proceed in fully-autonomous mode.",
  });
});

test("any autonomy mode escalates ambiguous actions", () => {
  const result = evaluateGuardrail({
    action: "reconcile the candidate record",
    autonomyMode: "fully-autonomous",
    ambiguous: true,
    risk: "low",
  });

  assert.equal(result.decision, "escalate");
  assert.match(result.reason, /ambiguous/i);
});
