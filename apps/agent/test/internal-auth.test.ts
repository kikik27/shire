import assert from "node:assert/strict";
import test from "node:test";

import { hasValidServiceToken } from "../src/runtime/auth/internal";

test("accepts only an exact bearer service token", () => {
  assert.equal(hasValidServiceToken("Bearer secret", "secret"), true);
  assert.equal(hasValidServiceToken("Bearer wrong", "secret"), false);
  assert.equal(hasValidServiceToken(undefined, "secret"), false);
  assert.equal(hasValidServiceToken("secret", "secret"), false);
});
