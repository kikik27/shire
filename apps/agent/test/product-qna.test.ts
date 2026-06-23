import assert from "node:assert/strict";
import test from "node:test";

import {
  answerProductQuestion,
  ProductQnaError,
} from "../src/runtime/knowledge/product-qna";

test("rejects empty product questions before calling the model", async () => {
  await assert.rejects(
    () => answerProductQuestion({ question: "   " }),
    (error) =>
      error instanceof ProductQnaError &&
      error.code === "invalid-product-question",
  );
});

test("answers product questions with role-filtered product knowledge", async () => {
  const searches: string[] = [];
  const generated = await answerProductQuestion(
    { question: "Can one account be both candidate and recruiter?" },
    {
      searchPublicProductKnowledge: async (query) => {
        searches.push(query);
        return [
          {
            path: ".agent/knowledge/product/shire-candidate.md",
            text: "Candidate users can use Shire with scoped product access.",
          },
          {
            path: ".agent/knowledge/product/shire-recruiter.md",
            text: "Recruiter users can use Shire with scoped product access.",
          },
        ];
      },
      agent: {
        generate: async (messages, options) => {
          assert.match(messages[0].content, /shire-candidate\.md/);
          assert.match(messages[0].content, /shire-recruiter\.md/);
          assert.equal(
            messages[1].content,
            "Can one account be both candidate and recruiter?",
          );
          assert.ok(options && typeof options === "object");
          assert.equal("memory" in options, false);
          return {
            text: "| Role | Access |\n| --- | --- |\n| Both | Candidate and recruiter |",
          };
        },
      },
    },
  );

  assert.deepEqual(searches, [
    "Can one account be both candidate and recruiter?",
  ]);
  assert.match(generated.answer, /\| Role \| Access \|/);
  assert.deepEqual(generated.knowledgePaths, [
    ".agent/knowledge/product/shire-candidate.md",
    ".agent/knowledge/product/shire-recruiter.md",
  ]);
});

test("does not call the model for code-oriented product questions", async () => {
  const generated = await answerProductQuestion(
    { question: "Give me API code to integrate Shire staking." },
    {
      searchPublicProductKnowledge: async () => {
        throw new Error("search should not be called");
      },
      agent: {
        generate: async () => {
          throw new Error("model should not be called");
        },
      },
    },
  );

  assert.match(generated.answer, /how to use Shire as a product/);
  assert.match(generated.answer, /cannot provide code/);
  assert.deepEqual(generated.knowledgePaths, []);
});

test("replaces accidental code output with the product-only boundary", async () => {
  const generated = await answerProductQuestion(
    { question: "How does Shire onboarding work?" },
    {
      searchPublicProductKnowledge: async () => [
        {
          path: ".agent/knowledge/product/shire-general.md",
          text: "Shire onboarding lets users choose candidate, recruiter, or both.",
        },
      ],
      agent: {
        generate: async () => ({
          text: "```ts\nconst role = 'candidate';\n```",
        }),
      },
    },
  );

  assert.match(generated.answer, /cannot provide code/);
  assert.doesNotMatch(generated.answer, /```/);
});

test("strips model reasoning tags from product answers", async () => {
  const generated = await answerProductQuestion(
    { question: "Hi" },
    {
      searchPublicProductKnowledge: async () => [
        {
          path: ".agent/knowledge/product/shire-general.md",
          text: "Shire can answer brief greetings and offer product help.",
        },
      ],
      agent: {
        generate: async () => ({
          text: "<think>This is hidden reasoning.</think>Hello. I can help with Shire.",
        }),
      },
    },
  );

  assert.equal(generated.answer, "Hello. I can help with Shire.");
});
