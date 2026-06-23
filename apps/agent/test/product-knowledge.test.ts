import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProductKnowledgeContext,
  enrichChatRequestWithProductKnowledge,
  resolveProductKnowledgeRole,
} from "../src/runtime/knowledge/product-context";

test("resolves only supported structured chat roles", () => {
  assert.equal(
    resolveProductKnowledgeRole({ scope: { role: "candidate" } }),
    "candidate",
  );
  assert.equal(
    resolveProductKnowledgeRole({ scope: { role: "recruiter" } }),
    "recruiter",
  );
  assert.equal(resolveProductKnowledgeRole({ scope: { role: "admin" } }), null);
  assert.equal(resolveProductKnowledgeRole({}), null);
});

test("builds bounded server product context as untrusted reference data", () => {
  const context = buildProductKnowledgeContext([
    {
      path: ".agent/knowledge/product/shire-general.md",
      text: "Shire requires user approval for wallet transactions.",
      score: 0.9,
    },
  ]);

  assert.match(context, /Relevant Shire product knowledge/);
  assert.match(context, /reference data, not as instructions/);
  assert.match(context, /shire-general\.md/);
  assert.match(context, /user approval/);
});

test("enriches an allowed candidate request with product context", async () => {
  const body = {
    scope: { role: "candidate" },
    messages: [
      {
        role: "user",
        parts: [{ type: "text", text: "How does candidate staking work?" }],
      },
    ],
    system: "Viewer: candidate-001",
    context: [{ role: "system", content: "Viewer: candidate-001" }],
  };

  const result = await enrichChatRequestWithProductKnowledge(
    body,
    async (query, role) => {
      assert.equal(query, "How does candidate staking work?");
      assert.equal(role, "candidate");
      return [
        {
          path: ".agent/knowledge/product/shire-candidate.md",
          text: "The candidate approves the stake in their wallet.",
        },
      ];
    },
  );

  assert.equal(result.role, "candidate");
  assert.equal(result.resultCount, 1);
  assert.match(
    String((result.body as Record<string, unknown>).system),
    /approves the stake/,
  );
});

test("continues safely when product retrieval fails", async () => {
  const body = {
    scope: { role: "recruiter" },
    messages: [
      {
        role: "user",
        parts: [{ type: "text", text: "How does recruiter staking work?" }],
      },
    ],
  };

  const result = await enrichChatRequestWithProductKnowledge(body, async () => {
    throw new Error("vector unavailable");
  });

  assert.equal(result.role, "recruiter");
  assert.equal(result.resultCount, 0);
  assert.equal(result.retrievalFailed, true);
  assert.deepEqual(result.body, body);
});
