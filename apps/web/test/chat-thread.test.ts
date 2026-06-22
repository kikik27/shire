import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChatProxyBody,
  resolveChatScopeForPathname,
} from "../lib/chat/context";
import {
  hasHiddenReasoning,
  stripHiddenReasoning,
} from "../lib/chat/reasoning";
import { buildChatScope, buildChatScopeLabel } from "../lib/chat/thread";

test("labels a candidate job scope clearly", () => {
  assert.equal(
    buildChatScopeLabel({
      role: "candidate",
      resourceType: "job",
      resourceLabel: "Senior Frontend Engineer",
    }),
    "Candidate / Job / Senior Frontend Engineer",
  );
});

test("labels a recruiter general scope clearly", () => {
  assert.equal(
    buildChatScopeLabel({
      role: "recruiter",
    }),
    "Recruiter / General",
  );
});

test("chat proxy body includes the active structured scope", () => {
  const scope = buildChatScope({
    viewerId: "candidate-001",
    role: "candidate",
    resourceType: "job",
    resourceId: "job-001",
    resourceLabel: "Senior Frontend Engineer",
  });

  const body = buildChatProxyBody(scope, [
    {
      id: "message-1",
      role: "user",
      parts: [{ type: "text", text: "How does applying work?" }],
    },
  ]);

  assert.deepEqual(body.scope, scope);
  assert.equal(body.memory.thread, scope.threadId);
  assert.equal(body.memory.resource, scope.resourceKey);
});

test("candidate profile path requests self-profile without browser-owned ids", () => {
  const scope = resolveChatScopeForPathname({
    role: "candidate",
    pathname: "/candidate/profile",
    candidateProfileLabel: "M. Zaky Arisandhi",
  });

  assert.deepEqual(scope, {
    role: "candidate",
    resourceType: "candidate",
    resourceId: undefined,
    resourceLabel: "M. Zaky Arisandhi",
  });
});

test("strips hidden model reasoning from rendered assistant text", () => {
  assert.equal(
    stripHiddenReasoning(
      "<think>The model is planning.</think>Hello. I can help with Shire.",
    ),
    "Hello. I can help with Shire.",
  );
  assert.equal(stripHiddenReasoning("<think>Still thinking"), "");
  assert.equal(hasHiddenReasoning("<think>Still thinking"), true);
});
