import assert from "node:assert/strict";
import test from "node:test";

import {
  buildKnowledgeFilter,
  buildKnowledgeSystemMessage,
  limitKnowledgeResults,
  syncKnowledgeBase,
  searchProductKnowledge,
} from "../src/runtime/knowledge";
import {
  knowledgeSources,
  productKnowledgeSources,
  repositoryKnowledgeSources,
} from "../src/runtime/knowledge/sources";

test("knowledge corpus excludes task and archive documents", () => {
  assert.equal(
    knowledgeSources.some((source) => source.path.includes("/tasks/")),
    false,
  );
  assert.equal(
    knowledgeSources.some((source) => source.path.includes("/archive/")),
    false,
  );
  assert.equal(knowledgeSources[0].path, ".agent/context/architecture.md");
});

test("retrieved context respects the character budget", () => {
  const limited = limitKnowledgeResults(
    [
      { path: "a.md", text: "a".repeat(60), score: 0.9 },
      { path: "b.md", text: "b".repeat(60), score: 0.8 },
    ],
    100,
  );

  assert.equal(limited.length, 1);
  assert.match(buildKnowledgeSystemMessage(limited), /a\.md/);
});

test("registers general, candidate, and recruiter product knowledge", () => {
  assert.deepEqual(
    productKnowledgeSources.map((source) => source.audience),
    ["general", "candidate", "recruiter"],
  );
  assert.deepEqual(
    productKnowledgeSources.map((source) => source.corpus),
    ["product", "product", "product"],
  );
  assert.equal(
    productKnowledgeSources.every((source) =>
      source.path.startsWith(".agent/knowledge/product/"),
    ),
    true,
  );
});

test("keeps repository and product knowledge explicitly separated", () => {
  assert.equal(
    repositoryKnowledgeSources.every(
      (source) => source.corpus === "repository",
    ),
    true,
  );
  assert.equal(
    knowledgeSources.length,
    repositoryKnowledgeSources.length + productKnowledgeSources.length,
  );
});

test("builds repository and role-aware product filters", () => {
  assert.deepEqual(buildKnowledgeFilter({ corpus: "repository" }), {
    corpus: "repository",
  });
  assert.deepEqual(
    buildKnowledgeFilter({ corpus: "product", role: "candidate" }),
    {
      corpus: "product",
      audience: { $in: ["general", "candidate"] },
    },
  );
  assert.deepEqual(
    buildKnowledgeFilter({ corpus: "product", role: "recruiter" }),
    {
      corpus: "product",
      audience: { $in: ["general", "recruiter"] },
    },
  );
});

test("product retrieval passes the role filter before ranking", async () => {
  let receivedFilter: unknown;

  const results = await searchProductKnowledge(
    "How does staking work?",
    "candidate",
    {
      embeddingsEnabled: true,
      indexes: ["shire_context"],
      embed: async () => ({ embedding: [0.1, 0.2] }),
      query: async (input) => {
        receivedFilter = input.filter;
        return [
          {
            score: 0.9,
            metadata: {
              path: ".agent/knowledge/product/shire-candidate.md",
              text: "Candidate staking requires wallet approval.",
            },
          },
        ];
      },
    },
  );

  assert.deepEqual(receivedFilter, {
    corpus: "product",
    audience: { $in: ["general", "candidate"] },
  });
  assert.equal(
    results[0]?.path,
    ".agent/knowledge/product/shire-candidate.md",
  );
});

test("product retrieval falls back to local role-filtered documents", async () => {
  const results = await searchProductKnowledge(
    "How does staking work?",
    "candidate",
    {
      indexes: [],
      embed: async () => {
        throw new Error("embedding should not run");
      },
      query: async () => {
        throw new Error("vector query should not run");
      },
      localDocuments: [
        {
          audience: "general",
          path: ".agent/knowledge/product/shire-general.md",
          text: "Shire uses escrow staking for applications.",
        },
        {
          audience: "candidate",
          path: ".agent/knowledge/product/shire-candidate.md",
          text: "Candidates approve staking in their wallet.",
        },
        {
          audience: "recruiter",
          path: ".agent/knowledge/product/shire-recruiter.md",
          text: "Recruiters manage company staking.",
        },
      ],
    },
  );

  assert.deepEqual(
    results.map((result) => result.path),
    [
      ".agent/knowledge/product/shire-general.md",
      ".agent/knowledge/product/shire-candidate.md",
    ],
  );
});

test("product retrieval skips vector embedding when embeddings are disabled", async () => {
  const results = await searchProductKnowledge(
    "How does staking work?",
    "candidate",
    {
      embeddingsEnabled: false,
      indexes: ["shire_context"],
      embed: async () => {
        throw new Error("embedding should not run");
      },
      query: async () => {
        throw new Error("vector query should not run");
      },
      localDocuments: [
        {
          audience: "candidate",
          path: ".agent/knowledge/product/shire-candidate.md",
          text: "Candidates approve staking in their wallet.",
        },
      ],
    },
  );

  assert.equal(results[0]?.path, ".agent/knowledge/product/shire-candidate.md");
});

test("product retrieval falls back when an existing index has no role metadata", async () => {
  const results = await searchProductKnowledge(
    "How do talent recommendations work?",
    "recruiter",
    {
      embeddingsEnabled: true,
      indexes: ["shire_context"],
      embed: async () => ({ embedding: [0.1, 0.2] }),
      query: async () => [],
      localDocuments: [
        {
          audience: "general",
          path: ".agent/knowledge/product/shire-general.md",
          text: "Shire provides matching recommendations.",
        },
        {
          audience: "candidate",
          path: ".agent/knowledge/product/shire-candidate.md",
          text: "Candidates receive job recommendations.",
        },
        {
          audience: "recruiter",
          path: ".agent/knowledge/product/shire-recruiter.md",
          text: "Recruiters receive talent recommendations.",
        },
      ],
    },
  );

  assert.deepEqual(
    results.map((result) => result.path),
    [
      ".agent/knowledge/product/shire-general.md",
      ".agent/knowledge/product/shire-recruiter.md",
    ],
  );
});

test("knowledge sync exposes corpus to embedding selection", async () => {
  const embeddedCorpora: string[] = [];
  const upserts: unknown[] = [];
  let writtenState: Record<string, string> | undefined;
  const vector = {
    listIndexes: async () => [],
    deleteVectors: async () => undefined,
    createIndex: async () => undefined,
    upsert: async (input: unknown) => {
      upserts.push(input);
    },
  };

  const result = await syncKnowledgeBase({
    vector: vector as never,
    manifestStore: {
      read: async () => {
        throw new Error("manifest should not be read when index does not exist");
      },
      write: async (state) => {
        writtenState = state;
      },
    },
    embed: async (values, corpus) => {
      embeddedCorpora.push(corpus);
      return { embeddings: values.map(() => [0.1, 0.2]) };
    },
  });

  assert.ok(result.indexedChunks > 0);
  assert.ok(upserts.length > 0);
  assert.ok(writtenState);
  assert.ok(Object.keys(writtenState).includes(knowledgeSources[0].path));
  assert.ok(embeddedCorpora.includes("repository"));
  assert.ok(embeddedCorpora.includes("product"));
});

test("knowledge sync deletes vectors for removed manifest paths", async () => {
  const deletedFilters: unknown[] = [];
  const vector = {
    listIndexes: async () => ["shire_context"],
    deleteVectors: async (input: unknown) => {
      deletedFilters.push(input);
    },
    createIndex: async () => undefined,
    upsert: async () => undefined,
  };

  await syncKnowledgeBase({
    vector: vector as never,
    manifestStore: {
      read: async () => ({ ".agent/knowledge/removed.md": "old-hash" }),
      write: async () => undefined,
    },
    embed: async (values) => ({
      embeddings: values.map(() => [0.1, 0.2]),
    }),
  });

  assert.deepEqual(deletedFilters, [
    {
      indexName: "shire_context",
      filter: { path: ".agent/knowledge/removed.md" },
    },
  ]);
});
