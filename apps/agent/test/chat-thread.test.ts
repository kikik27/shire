import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChatResourceKey,
  buildChatThreadScope,
} from "../src/runtime/chat/thread";

test("builds a general role thread key", () => {
  assert.deepEqual(
    buildChatThreadScope({
      viewerId: "me_candidate",
      role: "candidate",
    }),
    {
      threadId: "candidate:me_candidate",
      resourceKey: "candidate:me_candidate:general",
    },
  );
});

test("builds a resource-scoped recruiter thread key", () => {
  assert.deepEqual(
    buildChatThreadScope({
      viewerId: "rec_aperture",
      role: "recruiter",
      resourceType: "candidate",
      resourceId: "tal_sara",
    }),
    {
      threadId: "recruiter:rec_aperture:candidate:tal_sara",
      resourceKey: "recruiter:rec_aperture:candidate:tal_sara",
    },
  );
});

test("builds a general resource key directly", () => {
  assert.equal(
    buildChatResourceKey({
      viewerId: "me_candidate",
      role: "candidate",
    }),
    "candidate:me_candidate:general",
  );
});
