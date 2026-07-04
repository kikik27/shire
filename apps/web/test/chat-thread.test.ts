import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChatProxyBody,
  resolveChatScopeForPathname,
} from "../lib/chat/context";
import { buildThreadCopy } from "../lib/chat/thread-copy";
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

test("candidate job pages send the real job id without a demo catalog", () => {
  assert.deepEqual(
    resolveChatScopeForPathname({
      pathname: "/candidate/jobs/6a9f3157-88c4-4d2d-868e-584645a76a72",
      role: "candidate",
    }),
    {
      role: "candidate",
      resourceType: "job",
      resourceId: "6a9f3157-88c4-4d2d-868e-584645a76a72",
    },
  );
});

test("recruiter job pages send the real owned job id", () => {
  assert.deepEqual(
    resolveChatScopeForPathname({
      pathname: "/recruiter/jobs/job-real-1",
      role: "recruiter",
    }),
    {
      role: "recruiter",
      resourceType: "job",
      resourceId: "job-real-1",
    },
  );
});

test("recruiter job creation page stays in general chat scope", () => {
  assert.deepEqual(
    resolveChatScopeForPathname({
      pathname: "/recruiter/jobs/new",
      role: "recruiter",
    }),
    {
      role: "recruiter",
      resourceType: undefined,
      resourceId: undefined,
      resourceLabel: undefined,
    },
  );
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

test("builds candidate job assistant copy from active page scope", () => {
  const copy = buildThreadCopy({
    role: "candidate",
    resourceType: "job",
    resourceLabel: "Senior Frontend Engineer",
  });

  assert.equal(copy.emptyTitle, "Ask Shire about Senior Frontend Engineer");
  assert.equal(copy.placeholder, "Ask about this role...");
  assert.equal(copy.contextLabel, "Candidate + role context");
  assert.deepEqual(copy.suggestions, [
    "How well do I fit this role?",
    "What should I improve before applying?",
    "Explain the stake and escrow flow",
  ]);
});

test("builds recruiter hiring assistant copy from active page scope", () => {
  const copy = buildThreadCopy({
    role: "recruiter",
    resourceType: "job",
    resourceLabel: "Solidity Engineer",
  });

  assert.equal(copy.emptyTitle, "Ask Shire about Solidity Engineer");
  assert.equal(copy.placeholder, "Ask about this hiring role...");
  assert.equal(copy.contextLabel, "Recruiter + role context");
  assert.deepEqual(copy.suggestions, [
    "How can I improve this job post?",
    "What candidate signals matter most?",
    "What should I review next?",
  ]);
});
