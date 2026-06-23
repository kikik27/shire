import assert from "node:assert/strict";
import test from "node:test";

import { CandidateProfileDraftSchema } from "../src/runtime/cv/candidate-profile";
import { InMemoryCandidateProfileStore } from "../src/runtime/data/candidate-profile-store";
import { createCvParseProcessor } from "../src/runtime/jobs/cv-parse.processor";

const profile = CandidateProfileDraftSchema.parse({
  fullName: "Maya Okafor",
  headline: "Frontend Engineer",
  skills: ["TypeScript", "React"],
  profileConfidence: 0.91,
});

test("processes the supplied CV with an LLM and persists the draft", async () => {
  const store = new InMemoryCandidateProfileStore();
  const rawCv = "RAW PRIVATE CV FOR MAYA";
  const processor = createCvParseProcessor({
    generate: async () => ({
      profile,
      model: "openrouter/test-model",
      usage: { inputTokens: 30, outputTokens: 12, totalTokens: 42 },
    }),
    embed: async () => ({ embedding: [0.1, 0.2, 0.3] }),
    store,
  });

  const result = await processor.process(
    { candidateId: "candidate-001", rawCv },
    {
      jobId: "job-1",
      attempt: 1,
      signal: new AbortController().signal,
    },
  );

  const saved = await store.getById("candidate-001");
  assert.equal(result.llmInvoked, true);
  assert.equal(result.status, "PENDING_REVIEW");
  assert.equal(result.embeddingDimensions, 3);
  assert.equal(result.usage[0]?.totalTokens, 42);
  assert.doesNotMatch(saved?.embeddingText ?? "", /RAW PRIVATE CV/);
});

test("fails the job when LLM generation fails", async () => {
  const processor = createCvParseProcessor({
    generate: async () => {
      throw new Error("provider unavailable");
    },
    embed: async () => ({ embedding: [0.1] }),
    store: new InMemoryCandidateProfileStore(),
  });

  await assert.rejects(
    processor.process(
      { candidateId: "candidate-001", rawCv: "CV" },
      {
        jobId: "job-1",
        attempt: 1,
        signal: new AbortController().signal,
      },
    ),
    /exhausted 3 attempts/,
  );
});
